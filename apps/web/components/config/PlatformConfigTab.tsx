'use client';

import Link from 'next/link';
import { Cpu, Settings2 } from 'lucide-react';
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
    <div id="platform-settings" className="platform-config min-w-0 space-y-4 overflow-hidden">
      <div className="min-w-0">
        <p className="eyebrow">Platform configuration</p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">Connections & environments</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Configure each platform independently. Authentication and persistence stay inside its
          renderer.
        </p>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2" aria-label="TCE system controls">
        <Link
          href="#platform-settings"
          className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border/60 bg-background/50 p-4 transition hover:border-primary/40 hover:bg-background/80"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground transition group-hover:text-foreground">
            <Settings2 className="size-5" />
          </span>
          <span className="min-w-0">
            <strong className="block text-sm font-semibold text-foreground">Settings</strong>
            <span className="mt-0.5 block text-xs leading-5 text-muted">
              Platform credentials & environments
            </span>
          </span>
        </Link>

        <Link
          href="/engines"
          className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border/60 bg-background/50 p-4 transition hover:border-primary/40 hover:bg-background/80"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground transition group-hover:text-foreground">
            <Cpu className="size-5" />
          </span>
          <span className="min-w-0">
            <strong className="block text-sm font-semibold text-foreground">Engine Management</strong>
            <span className="mt-0.5 block text-xs leading-5 text-muted">
              Control TCE engines & runtime state
            </span>
          </span>
        </Link>
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
