import { Injectable, Logger } from '@nestjs/common';

export type CrawledStockEvent = {
  mongoId: string;
  symbol: string;
  exchange: string | null;
  exRightDate: string | null;
  recordDate: string | null;
  paymentDate: string | null;
  gdkhqTimestamp: string | null;
  eventContent: string;
  ratioText: string;
  dividendValue: number | null;
  referencePrice: number | null;
  rawData: Record<string, unknown>;
  crawledAt: string;
};

type CrawlOptions = {
  startDate?: string | null;
  endDate?: string | null;
  maxPages?: number;
};

const BASE_URL = 'https://finance.vietstock.vn';
const GROUP = 13;
const EXCHANGE = -1;
const DEFAULT_FROM_DATE = '2015-01-11';

@Injectable()
export class VietstockEventsCrawler {
  private readonly logger = new Logger(VietstockEventsCrawler.name);

  async crawl(options: CrawlOptions = {}): Promise<CrawledStockEvent[]> {
    const startDate = options.startDate || DEFAULT_FROM_DATE;
    const endDate = options.endDate || this.today();
    const maxPages = Math.min(Math.max(Number(options.maxPages ?? 200) || 200, 1), 500);
    const all: CrawledStockEvent[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
      const html = await this.fetchPage(page, startDate, endDate);
      const rows = this.parse(html);
      if (!rows.length) break;
      all.push(...rows);
      if (rows.length < 20) break;
    }

    const unique = new Map<string, CrawledStockEvent>();
    for (const row of all) unique.set(row.mongoId, row);
    this.logger.log(`Crawled ${unique.size} Vietstock events (${startDate} → ${endDate})`);
    return [...unique.values()];
  }

  private async fetchPage(page: number, fromDate: string, toDate: string) {
    const url = new URL(`${BASE_URL}/lich-su-kien/`);
    url.searchParams.set('group', String(GROUP));
    url.searchParams.set('exchange', String(EXCHANGE));
    url.searchParams.set('fromDate', this.toVietstockDate(fromDate));
    url.searchParams.set('toDate', this.toVietstockDate(toDate));
    url.searchParams.set('page', String(page));

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.7',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) throw new Error(`Vietstock HTTP ${response.status}`);
    return response.text();
  }

  private parse(html: string): CrawledStockEvent[] {
    const table = html.match(/<table[^>]*id=["']event-content["'][^>]*>([\s\S]*?)<\/table>/i)?.[0];
    if (!table) return [];
    const rowMatches = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(match => match[1]);
    if (rowMatches.length < 2) return [];

    const headers = this.cells(rowMatches[0]).map(cell => this.clean(this.stripTags(cell).replace(/[▼▲]/g, '')));
    if (!headers.length) return [];

    const rows: CrawledStockEvent[] = [];
    for (const rowHtml of rowMatches.slice(1)) {
      const cells = this.cells(rowHtml);
      if (cells.length < headers.length) continue;
      const data: Record<string, string> = {};
      headers.forEach((header, index) => {
        data[header] = this.clean(this.stripTags(cells[index] ?? ''));
      });
      const symbol = (data['Mã CK'] || data['Mã chứng khoán'] || '').toUpperCase();
      const exRightDate = this.parseVietstockDate(data['Ngày GDKHQ']);
      if (!symbol || !exRightDate) continue;

      const mongoId = `${symbol}:${exRightDate}:${data['Nội dung sự kiện'] || ''}`;
      const dividendValue = this.parseDividendValue(data['Nội dung sự kiện'] || '');
      rows.push({
        mongoId,
        symbol,
        exchange: data['Sàn'] || data['Sàn GD'] || null,
        exRightDate,
        recordDate: this.parseVietstockDate(data['Ngày ĐKCC']),
        paymentDate: this.parseVietstockDate(data['Ngày thực hiện']),
        gdkhqTimestamp: exRightDate ? `${exRightDate}T00:00:00.000Z` : null,
        eventContent: data['Nội dung sự kiện'] || '',
        ratioText: data['Tỷ lệ'] || '',
        dividendValue,
        referencePrice: this.parseNumber(data['Giá tham chiếu']),
        rawData: data,
        crawledAt: new Date().toISOString(),
      });
    }
    return rows;
  }

  private cells(rowHtml: string) {
    return [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => match[1]);
  }

  private stripTags(value: string) {
    return value.replace(/<br\s*\/?>(?=.)/gi, ' ').replace(/<[^>]+>/g, ' ');
  }

  private clean(value: string) {
    return value.replace(/&nbsp;/gi, ' ').replace(/&#x27;/gi, "'").replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
  }

  private parseDividendValue(content: string) {
    const match = content.match(/(\d{1,3}(?:[,.]\d{3})*)\s*đồng\/CP/i);
    return match ? Number(match[1].replace(/[,.]/g, '')) : null;
  }

  private parseNumber(value?: string) {
    if (!value) return null;
    const normalized = value.replace(/,/g, '').replace(/\./g, '.').replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseVietstockDate(value?: string) {
    const match = value?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  private toVietstockDate(value: string) {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
  }

  private today() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
}
