'use client';

import { useMemo, useState } from 'react';
import SSIPlatformConfig from './platforms/SSIPlatformConfig';
import BinancePlatformConfig from './platforms/BinancePlatformConfig';
import FastApiPlatformConfig from './platforms/FastApiPlatformConfig';
import GeminiPlatformConfig from './platforms/GeminiPlatformConfig';
import type { PlatformConfigProps, PlatformDefinition } from './platforms/types';

export default function PlatformConfigTab() {
  const [busy, setBusy] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState('binance');
  const platforms = useMemo<PlatformDefinition[]>(
    () => [
      { id: 'ssi', label: 'SSI FastConnect', component: SSIPlatformConfig },
      { id: 'binance', label: 'Binance Futures', component: BinancePlatformConfig },
      { id: 'gemini', label: 'Gemini 2.5 Flash', component: GeminiPlatformConfig },
      { id: 'fastapi', label: 'FastAPI', component: FastApiPlatformConfig },
    ],
    []
  );
  const props: PlatformConfigProps = { busy, setBusy };
  const active = platforms.find(platform => platform.id === activePlatform) ?? platforms[0];
  const Component = active.component;

  return (
    <div className="platform-config min-w-0 space-y-3 overflow-hidden">
      <div className="min-w-0">
        <p className="eyebrow">Platform configuration</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-foreground">Connections & environments</h2>
            <p className="mt-0.5 hidden text-sm leading-5 text-muted sm:block">
              Select a platform, configure it, then verify before saving.
            </p>
          </div>
          <label className="shrink-0">
            <span className="sr-only">Platform</span>
            <select
              value={activePlatform}
              onChange={event => setActivePlatform(event.target.value)}
              className="h-10 max-w-[180px] rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm font-medium text-white outline-none"
            >
              {platforms.map(platform => (
                <option key={platform.id} value={platform.id}>
                  {platform.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="min-w-0">
        <Component {...props} />
      </div>
    </div>
  );
}
