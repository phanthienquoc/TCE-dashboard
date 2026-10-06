import { describe, expect, it, vi } from 'vitest';

import { normalizeHoldSymbols, ProfitExitCronService } from './profit-exit-cron.service';
import { ProfitExitSettingsController } from './profit-exit-settings.controller';

describe('ProfitExitSettingsController', () => {
  it('reads settings and available symbols for the current TCE account', async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: 'account-1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          auto_sell_enabled: true,
          auto_sell_profit_target_pct: 10,
          auto_sell_interval_minutes: 60,
          auto_sell_last_run_at: null,
          auto_sell_hold_symbols: [' fpt ', 'VNM', 'fpt'],
        },
        error: null,
      });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn((table: string) => {
      if (table === 'tce_accounts') return { select };
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            neq: vi.fn(() => ({
              then: undefined,
            })),
          })),
        })),
      };
    });
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'tce_accounts') return { select };
        if (table === 'tce_strategy_config') return { select };
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              neq: vi.fn(() =>
                Promise.resolve({ data: [{ symbol: 'vnm' }, { symbol: 'fpt' }], error: null })
              ),
            })),
          })),
        };
      }),
    };
    const jwt = { verify: vi.fn(() => ({ sub: 'user-1' })) };
    const cron = { run: vi.fn() } as unknown as ProfitExitCronService;
    const controller = new ProfitExitSettingsController({ db } as never, jwt as never, cron);

    await expect(controller.get('Bearer token')).resolves.toEqual({
      enabled: true,
      profitTargetPct: 10,
      intervalMinutes: 60,
      holdSymbols: ['FPT', 'VNM'],
      availableSymbols: ['FPT', 'VNM'],
      lastRunAt: null,
    });
    expect(jwt.verify).toHaveBeenCalledWith('token');
  });

  it('normalizes HOLD symbols', () => {
    expect(normalizeHoldSymbols([' vnm ', 'FPT', 'vnm', '', 123])).toEqual(['FPT', 'VNM']);
  });
});
