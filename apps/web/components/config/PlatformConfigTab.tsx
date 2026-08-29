'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import SSIPlatformConfig from './platforms/SSIPlatformConfig';
import BinancePlatformConfig from './platforms/BinancePlatformConfig';
import FastApiPlatformConfig from './platforms/FastApiPlatformConfig';
import type { PlatformConfigProps, PlatformDefinition } from './platforms/types';

export default function PlatformConfigTab() {
  const [busy, setBusy] = useState<string | null>(null);
  const platforms = useMemo<PlatformDefinition[]>(
    () => [
      { id: 'ssi', label: 'SSI FastConnect', component: SSIPlatformConfig },
      { id: 'binance', label: 'Binance Futures', component: BinancePlatformConfig },
      { id: 'fastapi', label: 'FastAPI', component: FastApiPlatformConfig },
    ],
    []
  );

  const props: PlatformConfigProps = { busy, setBusy };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#887b91]">
          Platform configuration
        </p>
        <h2 className="mt-1 text-xl font-semibold">Connections & environments</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Configure each platform independently. Platform-specific authentication and persistence
          stay inside its renderer.
        </p>
      </div>

      <Tabs defaultValue={platforms[0].id} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          {platforms.map(platform => (
            <TabsTrigger key={platform.id} value={platform.id}>
              {platform.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {platforms.map(platform => {
          const Component = platform.component;
          return (
            <TabsContent key={platform.id} value={platform.id}>
              <Component {...props} />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
