'use client';

import { Cpu } from 'lucide-react';

export default function TechLoading({ label = 'Initializing TCE runtime' }: { label?: string }) {
  return (
    <div className="tce-tech-loader" role="status" aria-live="polite">
      <div className="tce-tech-loader-grid" aria-hidden="true" />
      <div className="tce-tech-loader-orbit" aria-hidden="true">
        <span />
      </div>
      <div className="tce-tech-loader-core" aria-hidden="true">
        <Cpu className="size-5" />
      </div>
      <div className="tce-tech-loader-copy">
        <span className="tce-tech-loader-label">TCE // SYSTEM</span>
        <span className="tce-tech-loader-status">
          <i aria-hidden="true" /> {label}
        </span>
      </div>
    </div>
  );
}
