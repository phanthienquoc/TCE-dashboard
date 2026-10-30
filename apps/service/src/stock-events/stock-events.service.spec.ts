import { afterEach, describe, expect, it, vi } from 'vitest';
import { StockEventsService } from './stock-events.service';
import type { MongoDbClient } from '../db/mongodb.client';
import type { StockEventsSupabaseRepository } from './stock-events.supabase.repository';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('StockEventsService.getUpcoming limit contract', () => {
  it('clamps oversized requests to the supported maximum of 200', async () => {
    vi.stubEnv('STOCK_EVENTS_READ_SOURCE', 'supabase');
    const getUpcoming = vi.fn().mockResolvedValue([]);
    const service = new StockEventsService(
      {} as MongoDbClient,
      { getUpcoming } as unknown as StockEventsSupabaseRepository
    );

    await service.getUpcoming(2000);

    expect(getUpcoming).toHaveBeenCalledOnce();
    expect(getUpcoming).toHaveBeenCalledWith(200);
  });

  it('preserves a valid requested limit below the maximum', async () => {
    vi.stubEnv('STOCK_EVENTS_READ_SOURCE', 'supabase');
    const getUpcoming = vi.fn().mockResolvedValue([]);
    const service = new StockEventsService(
      {} as MongoDbClient,
      { getUpcoming } as unknown as StockEventsSupabaseRepository
    );

    await service.getUpcoming(120);

    expect(getUpcoming).toHaveBeenCalledWith(120);
  });
});
