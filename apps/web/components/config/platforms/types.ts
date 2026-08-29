import type { ComponentType } from 'react';

export type PlatformId = 'ssi' | 'binance' | 'fastapi';

export type PlatformConfigProps = {
  busy: string | null;
  setBusy: (value: string | null) => void;
};

export type PlatformDefinition = {
  id: PlatformId;
  label: string;
  component: ComponentType<PlatformConfigProps>;
};
