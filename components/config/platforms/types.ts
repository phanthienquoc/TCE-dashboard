import type { ComponentType } from 'react';

export type PlatformId = 'ssi' | 'binance' | 'fastapi';

export interface PlatformConfigProps {
  busy: string | null;
  setBusy: (value: string | null) => void;
}

export interface PlatformDefinition {
  id: PlatformId;
  label: string;
  component: ComponentType<PlatformConfigProps>;
}
