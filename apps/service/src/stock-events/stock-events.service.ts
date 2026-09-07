import { Injectable, ServiceUnavailableException } from '@nestjs/common';

const DEFAULT_LIMIT = 100;
const DEFAULT_SOURCE = 'http://stock-backend:8080/api/stocks';

type StockEventRow = {
  id?: string;
  ticker?: string;
  ex_dividend_date?: string;
  gdkhq_timestamp?: string | null;
  event_content?: string;
  dividend_rate?: string;
  dividend_value?: number;
  crawled_at?: string | null;
};

@Injectable()
export class StockEventsService {
  async getUpcoming(limit = DEFAULT_LIMIT) {
    const source = process.env.STOCK_EVENTS_API_URL || DEFAULT_SOURCE;
    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 200);
    const today = new Date().toISOString().slice(0, 10);
    const url = new URL(source);
    url.searchParams.set('startDate', today);
    url.searchParams.set('page', '1');
    url.searchParams.set('pageSize', String(safeLimit));

    let response: Response;
    try {
      response = await fetch(url, { cache: 'no-store' });
    } catch (error) {
      throw new ServiceUnavailableException(
        `Stock events source is unreachable: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(`Stock events source returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as { data?: StockEventRow[] } | StockEventRow[];
    const rows = Array.isArray(payload) ? payload : (payload.data ?? []);

    return rows
      .map(row => ({
        id: String(
          row.id ?? `${row.ticker ?? ''}|${row.ex_dividend_date ?? ''}|${row.event_content ?? ''}`
        ),
        ticker: row.ticker ?? '',
        exDividendDate: row.ex_dividend_date ?? '',
        exDividendTimestamp: row.gdkhq_timestamp ?? null,
        eventContent: row.event_content ?? '',
        dividendRate: row.dividend_rate ?? '',
        dividendValue: Number(row.dividend_value ?? 0),
        crawledAt: row.crawled_at ?? null,
      }))
      .filter(row => row.ticker && row.exDividendDate);
  }
}
