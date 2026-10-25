import { describe, expect, it, vi } from 'vitest';
import { StockEventsSupabaseRepository } from './stock-events.supabase.repository';

describe('StockEventsSupabaseRepository', () => {
  it('maps the canonical row shape to the API event shape', async () => {
    const supabase = {
      db: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'uuid',
                      mongo_id: 'mongo-1',
                      symbol: 'AAA',
                      ex_right_date: '2026-01-02',
                      gdkhq_timestamp: '2026-01-02T00:00:00.000Z',
                      payment_date: '2026-01-10',
                      event_content: 'Dividend',
                      ratio_text: '10%',
                      dividend_value: 1000,
                      reference_price: 20000,
                      crawled_at: null,
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      },
    } as any;

    const result = await new StockEventsSupabaseRepository(supabase).getUpcoming(10);
    expect(result[0]).toMatchObject({
      id: 'mongo-1',
      ticker: 'AAA',
      exDividendDate: '2026-01-02',
      dividendValue: 1000,
      price: 20000,
    });
  });
});
