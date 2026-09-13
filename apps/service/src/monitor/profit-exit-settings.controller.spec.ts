import { ProfitExitSettingsController } from './profit-exit-settings.controller';

describe('ProfitExitSettingsController', () => {
  it('uses the current TCE account to read profit-exit settings', async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: 'account-1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          auto_sell_enabled: true,
          auto_sell_profit_target_pct: 10,
          auto_sell_interval_minutes: 60,
          auto_sell_last_run_at: null,
        },
        error: null,
      });
    const eq = jest.fn(() => ({ maybeSingle }));
    const select = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ select }));
    const jwt = { verify: jest.fn(() => ({ sub: 'user-1' })) };
    const controller = new ProfitExitSettingsController({ db: { from } } as never, jwt as never);

    await expect(controller.get('Bearer token')).resolves.toEqual({
      enabled: true,
      profitTargetPct: 10,
      intervalMinutes: 60,
      lastRunAt: null,
    });
    expect(from).toHaveBeenNthCalledWith(1, 'tce_accounts');
    expect(from).toHaveBeenNthCalledWith(2, 'tce_strategy_config');
    expect(jwt.verify).toHaveBeenCalledWith('token');
  });
});
