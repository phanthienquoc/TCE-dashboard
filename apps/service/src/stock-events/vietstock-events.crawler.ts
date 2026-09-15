import { Injectable, Logger } from '@nestjs/common';
import puppeteer, { type Browser, type Page } from 'puppeteer';

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
  batchSize?: number;
  onBatch?: (events: CrawledStockEvent[], pageNumber: number, estimatedTotal: number | null) => Promise<void>;
};

type VietstockPage = { rows: unknown[]; hasMore: boolean; total: number | null };
type BrowserSession = { browser: Browser; page: Page; fromDate: string; toDate: string };

const BASE_URL = 'https://finance.vietstock.vn';
const EVENTS_PAGE = '/lich-su-kien.htm';
const GROUP = 13;
const EXCHANGE = -1;
const PAGE_SIZE = 30;
const DEFAULT_FROM_DATE = '2015-01-11';
const DEFAULT_BATCH_SIZE = 200;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';

@Injectable()
export class VietstockEventsCrawler {
  private readonly logger = new Logger(VietstockEventsCrawler.name);

  async crawl(options: CrawlOptions = {}): Promise<CrawledStockEvent[]> {
    const startDate = options.startDate || DEFAULT_FROM_DATE;
    const endDate = options.endDate || this.today();
    const maxPages = Math.min(Math.max(Number(options.maxPages ?? 200) || 200, 1), 500);
    const batchSize = Math.min(Math.max(Math.trunc(options.batchSize ?? DEFAULT_BATCH_SIZE), 30), 500);
    const all: CrawledStockEvent[] = [];
    const session = await this.createBrowserSession(startDate, endDate);
    let batch: CrawledStockEvent[] = [];
    let estimatedTotal: number | null = null;

    try {
      for (let page = 1; page <= maxPages; page += 1) {
        const result = await this.fetchPage(page, session);
        const rows = this.parseRows(result.rows);
        estimatedTotal = result.total ?? estimatedTotal;
        this.logger.log(`Vietstock events page=${page}: raw=${result.rows.length}, parsed=${rows.length}, total=${result.total ?? 'unknown'}`);
        if (!rows.length) break;
        if (options.onBatch) {
          batch.push(...rows);
          while (batch.length >= batchSize) {
            const nextBatch = batch.splice(0, batchSize);
            await options.onBatch(nextBatch, page, estimatedTotal);
          }
        } else {
          all.push(...rows);
        }
        if (!result.hasMore || result.rows.length < PAGE_SIZE) break;
      }
      if (options.onBatch && batch.length) await options.onBatch(batch, maxPages, estimatedTotal);
    } finally {
      await session.browser.close();
    }

    if (options.onBatch) {
      this.logger.log(`Crawled Vietstock events in batches (${startDate} → ${endDate})`);
      return [];
    }
    const unique = new Map<string, CrawledStockEvent>();
    for (const row of all) unique.set(row.mongoId, row);
    this.logger.log(`Crawled ${unique.size} Vietstock events (${startDate} → ${endDate})`);
    return [...unique.values()];
  }

  private async createBrowserSession(fromDate: string, toDate: string): Promise<BrowserSession> {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (!executablePath) throw new Error('PUPPETEER_EXECUTABLE_PATH is not configured');

    const browser = await puppeteer.launch({
      executablePath,
      headless: 'shell',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.7' });

    try {
      await this.gotoEventsPage(page, fromDate, toDate, 1);
      return { browser, page, fromDate, toDate };
    } catch (error) {
      await browser.close().catch(() => undefined);
      throw error;
    }
  }

  private async fetchPage(pageNumber: number, session: BrowserSession): Promise<VietstockPage> {
    await this.gotoEventsPage(session.page, session.fromDate, session.toDate, pageNumber);

    // Vietstock is an SPA: the initial document is only the application shell.
    // Read the final table produced by the SPA after its own background request
    // completes instead of calling the internal endpoint ourselves.
    const tableHtml = await this.readRenderedTable(session.page);
    const rows = this.parseHtmlRows(tableHtml);
    return {
      rows,
      hasMore: rows.length >= PAGE_SIZE,
      total: this.parseRenderedTotal(tableHtml),
    };
  }

  private async gotoEventsPage(page: Page, fromDate: string, toDate: string, pageNumber: number): Promise<void> {
    const url = new URL(EVENTS_PAGE, BASE_URL);
    url.searchParams.set('group', String(GROUP));
    url.searchParams.set('exchange', String(EXCHANGE));
    url.searchParams.set('fromDate', this.toVietstockDate(fromDate));
    url.searchParams.set('toDate', this.toVietstockDate(toDate));
    url.searchParams.set('page', String(pageNumber));
    url.searchParams.set('tab', '1');

    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForSelector('#event-content', { timeout: 45_000 });
  }

  private async readRenderedTable(page: Page): Promise<string> {
    // Rows are rendered asynchronously by the SPA. Prefer waiting for rows,
    // but allow an empty-result page to proceed after the table itself exists.
    try {
      await page.waitForSelector('#event-content tbody tr', { timeout: 20_000 });
    } catch {
      await new Promise(resolve => setTimeout(resolve, 750));
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await page.$eval('#event-content', element => element.outerHTML);
      } catch (error) {
        const message = String(error);
        if (!message.toLowerCase().includes('detached') || attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    throw new Error('Unable to read rendered Vietstock events table');
  }

  private parseHtmlRows(html: string): Record<string, string>[] {
    const table = html.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i)?.[0];
    if (!table) return [];

    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(match => match[1]);
    if (!rows.length) return [];

    const headerIndex = rows.findIndex(row => /<t[hd]\b/i.test(row));
    if (headerIndex < 0) return [];

    const headers = this.cells(rows[headerIndex]).map(cell => this.clean(this.stripTags(cell).replace(/[▼▲]/g, '')));
    return rows.slice(headerIndex + 1).flatMap(row => {
      const cells = this.cells(row);
      if (!cells.length) return [];
      return [Object.fromEntries(headers.map((header, index) => [header || `column${index}`, this.clean(this.stripTags(cells[index] ?? ''))]))];
    });
  }

  private parseRenderedTotal(html: string): number | null {
    const text = this.clean(this.stripTags(html));
    const matches = [...text.matchAll(/(?:Tổng số|Total|records)\s*[:：]?\s*([\d,.]+)/gi)];
    if (!matches.length) return null;
    const value = Number(matches[matches.length - 1][1].replace(/[,.]/g, ''));
    return Number.isFinite(value) ? value : null;
  }

  private parseRows(rows: unknown[]): CrawledStockEvent[] {
    const parsed: CrawledStockEvent[] = [];
    for (const row of rows) {
      const data = this.normalizeRow(row);
      const symbol = this.pick(data, ['Mã CK', 'Mã chứng khoán', 'Code', 'StockCode', 'stockCode', 'Symbol', 'symbol']).toUpperCase();
      const eventContent = this.pick(data, ['Nội dung sự kiện', 'EventContent', 'EventName', 'Content', 'eventContent']);
      const exRightDate = this.parseAnyDate(this.pick(data, ['Ngày GDKHQ', 'ExRightDate', 'ExDate', 'GDKHQDate', 'exRightDate']));
      if (!symbol || !exRightDate) continue;
      parsed.push({
        mongoId: `${symbol}:${exRightDate}:${eventContent}`,
        symbol,
        exchange: this.pick(data, ['Sàn', 'Sàn GD', 'Exchange', 'exchange']) || null,
        exRightDate,
        recordDate: this.parseAnyDate(this.pick(data, ['Ngày ĐKCC', 'RecordDate', 'recordDate'])),
        paymentDate: this.parseAnyDate(this.pick(data, ['Ngày thực hiện', 'PaymentDate', 'paymentDate'])),
        gdkhqTimestamp: `${exRightDate}T00:00:00.000Z`,
        eventContent,
        ratioText: this.pick(data, ['Tỷ lệ', 'Ratio', 'RatioText', 'ratioText']),
        dividendValue: this.parseDividendValue(eventContent),
        referencePrice: this.parseNumber(this.pick(data, ['Giá tham chiếu', 'ReferencePrice', 'referencePrice'])),
        rawData: data,
        crawledAt: new Date().toISOString(),
      });
    }
    return parsed;
  }

  private normalizeRow(row: unknown): Record<string, string> {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      return Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([key, value]) => [key, this.clean(String(value ?? ''))]));
    }
    if (typeof row === 'string') return this.parseHtmlRow(row);
    return {};
  }

  private parseHtmlRow(html: string) {
    const cells = this.cells(html).map(cell => this.clean(this.stripTags(cell)));
    return Object.fromEntries(cells.map((value, index) => [`column${index}`, value]));
  }

  private cells(rowHtml: string) {
    return [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => match[1]);
  }

  private stripTags(value: string) {
    return value.replace(/<br\s*\/?>(?=.)/gi, ' ').replace(/<[^>]+>/g, ' ');
  }

  private clean(value: string) {
    return value.replace(/&nbsp;/gi, ' ').replace(/&#x27;/gi, "'").replace(/&#39;/gi, "'").replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();
  }

  private pick(data: Record<string, string>, keys: string[]) {
    for (const key of keys) if (data[key]) return data[key];
    return '';
  }

  private parseDividendValue(content: string) {
    const match = content.match(/(\d{1,3}(?:[,.]\d{3})*)\s*đồng\/CP/i);
    return match ? Number(match[1].replace(/[,.]/g, '')) : null;
  }

  private parseNumber(value?: string) {
    if (!value) return null;
    const normalized = value.replace(/,/g, '').replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseAnyDate(value?: string) {
    if (!value) return null;
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
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
