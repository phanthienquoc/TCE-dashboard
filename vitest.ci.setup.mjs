import { vi } from 'vitest';

// CI-only compatibility for legacy specs that still reference Jest's global.
globalThis.jest = vi;
