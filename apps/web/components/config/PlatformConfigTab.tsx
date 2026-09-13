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
    <div className="platform-config min-w-0 overflow-hidden">
      <div className="min-w-0">
        <p className="eyebrow">Platform configuration</p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">Connections & environments</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Configure each platform independently. Authentication and persistence stay inside its
          renderer.
        </p>
      </div>

      <div className="mt-5 min-w-0">
        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-muted">Platform</span>
          <select
            value={activePlatform}
            onChange={event => setActivePlatform(event.target.value)}
            className="h-11 w-full max-w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm font-medium text-white outline-none focus:border-white/20"
          >
            {platforms.map(platform => (
              <option key={platform.id} value={platform.id}>
                {platform.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 min-w-0">
        <Component {...props} />
      </div>
    </div>
  );
}
