import type { AccountDataPlatform, PlatformStatus } from '@tce/platform';
import type { SsiAuthInput, SsiCredentials } from './index';

export interface SsiPlatform extends AccountDataPlatform {
  readonly kind: 'ssi';
  configure(credentials: SsiCredentials): void;
  authenticate(input?: SsiAuthInput): Promise<void>;
}

export const SSI_PLATFORM_DEFAULTS: PlatformStatus = {
  provider: 'ssi',
  configured: false,
  connected: false,
  environment: 'production',
  lastSyncAt: null,
  error: null,
};
