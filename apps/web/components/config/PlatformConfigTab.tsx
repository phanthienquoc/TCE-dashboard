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
    <div className="min-w-0 space-y-4 overflow-hidden">
      <div className="min-w-0">
        <p className="eyebrow">Platform configuration</p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">Connections & environments</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Configure each platform independently. Authentication and persistence stay inside its
          renderer.
        </p>
      </div>
      <Tabs defaultValue={platforms[0].id} className="w-full min-w-0">
        <TabsList className="w-full min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {platforms.map(platform => (
            <TabsTrigger key={platform.id} value={platform.id}>
              {platform.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {platforms.map(platform => {
          const Component = platform.component;
          return (
            <TabsContent key={platform.id} value={platform.id} className="min-w-0">
              <Component {...props} />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
