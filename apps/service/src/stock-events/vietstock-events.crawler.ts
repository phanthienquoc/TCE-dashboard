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

type CrawlPageMeta = {
  rowsOnPage: number;
  hasMore: boolean;
};

type CrawlOptions = {
  startDate?: string | null;
  endDate?: string | null;
  maxPages?: number;
  batchSize?: number;
  pageSize?: number;
  onPage?: (pageNumber: number, rowsOnPage: number, total: number | null, hasMore: boolean) => Promise<void>;
  onBatch?: (events: CrawledStockEvent[], pageNumber: number, estimatedTotal: number | null, meta: CrawlPageMeta) => Promise<void>;
};

type VietstockPage = { rows: unknown[]; hasMore: boolean; total: number | null };
type BrowserSession = { browser: Browser; page: Page; fromDate: string; toDate: string; pageSize: number };

const BASE_URL = 'https://finance.vietstock.vn';
const EVENTS_PAGE = '/lich-su-kien.htm';
const GROUP = 13;
const EXCHANGE = -1;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_FROM_DATE = '2015-01-11';
const DEFAULT_BATCH_SIZE = 200;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';
const RENDER_TIMEOUT_MS = 45_000;
const STABLE_SAMPLE_DELAY_MS = 350;

@Injectable()
export class VietstockEventsCrawler {
  private readonly logger = new Logger(VietstockEventsCrawler.name);

  async crawl(options: CrawlOptions = {}): Promise<CrawledStockEvent[]> {
    const startDate = options.startDate || DEFAULT_FROM_DATE;
    const endDate = options.endDate || this.today();
    const maxPages = Math.min(Math.max(Number(options.maxPages ?? 200) || 200, 1), 500);
    const batchSize = Math.min(Math.max(Math.trunc(options.batchSize ?? DEFAULT_BATCH_SIZE), 30), 500);
    const pageSize = Math.min(Math.max(Math.trunc(options.pageSize ?? DEFAULT_PAGE_SIZE), 1), 100);
    const all: CrawledStockEvent[] = [];
    const session = await this.createBrowserSession(startDate, endDate, pageSize);
    let batch: CrawledStockEvent[] = [];
    let estimatedTotal: number | null = null;
    let lastPageProcessed = 0;
    let lastPageMeta: CrawlPageMeta = { rowsOnPage: 0, hasMore: false };

    try {
      for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
        const result = await this.fetchPage(pageNumber, session);
        const rows = this.parseRows(result.rows);
        const meta: CrawlPageMeta = {
          rowsOnPage: result.rows.length,
          hasMore: result.hasMore,
        };
        estimatedTotal = result.total ?? estimatedTotal;
        lastPageProcessed = pageNumber;
        lastPageMeta = meta;

        this.logger.log(
          `Vietstock events page=${pageNumber}: raw=${result.rows.length}, parsed=${rows.length}, hasMore=${result.hasMore}, total=${result.total ?? 'unknown'}`,
        );

        await options.onPage?.(pageNumber, result.rows.length, estimatedTotal, result.hasMore);

        if (options.onBatch) {
          batch.push(...rows);
          while (batch.length >= batchSize) {
            const nextBatch = batch.splice(0, batchSize);
            await options.onBatch(nextBatch, pageNumber, estimatedTotal, meta);
          }
        } else {
          all.push(...rows);
        }

        if (!result.hasMore) break;
      }

      if (options.onBatch && batch.length) {
        await options.onBatch(batch, lastPageProcessed || 1, estimatedTotal, lastPageMeta);
      }
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

  private async createBrowserSession(fromDate: string, toDate: string, pageSize: number): Promise<BrowserSession> {
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
      await this.gotoEventsPage(page, fromDate, toDate, 1, pageSize);
      return { browser, page, fromDate, toDate, pageSize };
    } catch (error) {
      await browser.close().catch(() => undefined);
      throw error;
    }
  }

  private async fetchPage(pageNumber: number, session: BrowserSession): Promise<VietstockPage> {
    await this.gotoEventsPage(session.page, session.fromDate, session.toDate, pageNumber, session.pageSize);

    const tableHtml = await this.readRenderedTable(session.page);
    const rows = this.parseHtmlRows(tableHtml);
    const total = this.parseRenderedTotal(tableHtml);
    const hasMore = this.resolveHasMore(session.page, rows.length, total, pageNumber, session.pageSize);

    return { rows, hasMore, total };
  }

  private async gotoEventsPage(page: Page, fromDate: string, toDate: string, pageNumber: number, pageSize: number): Promise<void> {
    const url = new URL(EVENTS_PAGE, BASE_URL);
    url.searchParams.set('group', String(GROUP));
    url.searchParams.set('exchange', String(EXCHANGE));
    url.searchParams.set('fromDate', this.toVietstockDate(fromDate));
    url.searchParams.set('toDate', this.toVietstockDate(toDate));
    url.searchParams.set('page', String(pageNumber));
    url.searchParams.set('pageSize', String(pageSize));
    url.searchParams.set('tab', '1');

    const response = await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: RENDER_TIMEOUT_MS });
    const status = response?.status();
    try {
      await page.waitForSelector('#event-content', { timeout: RENDER_TIMEOUT_MS });
    } catch (error) {
      const title = await page.title().catch(() => '');
      const url = page.url();
      const reason = error instanceof Error ? error.message : JSON.stringify(error);
      throw new Error(`Vietstock page load failed (HTTP ${status ?? 'unknown'}, title="${title}", url=${url}): ${reason}`);
    }
  }

  private async readRenderedTable(page: Page): Promise<string> {
    await page.waitForFunction(
      () => {
        const root = document.querySelector('#event-content');
        if (!root) return false;
        const rows = root.querySelectorAll('tbody tr');
        if (rows.length > 0) return true;
        const text = (root.textContent || '').toLowerCase();
        return /không có|no data|no records|không tìm thấy/.test(text);
      },
      { timeout: RENDER_TIMEOUT_MS },
    );

    let previous = '';
    let stableSamples = 0;
    const deadline = Date.now() + RENDER_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const snapshot = await page.$eval('#event-content', element => {
        const root = element as HTMLElement;
        const rows = [...root.querySelectorAll('tbody tr')].map(row => (row.textContent || '').replace(/\s+/g, ' ').trim());
        return JSON.stringify({ rows, text: root.textContent?.replace(/\s+/g, ' ').trim().slice(-500) || '' });
      });

      if (snapshot === previous) stableSamples += 1;
      else stableSamples = 0;
      previous = snapshot;

      if (stableSamples >= 2) return await page.$eval('#event-content', element => element.outerHTML);
      await new Promise(resolve => setTimeout(resolve, STABLE_SAMPLE_DELAY_MS));
    }

    throw new Error(`Vietstock events page did not stabilize within ${RENDER_TIMEOUT_MS}ms`);
  }

  private resolveHasMore(_page: Page, rowCount: number, total: number | null, pageNumber: number, pageSize: number) {
    if (total != null) return pageNumber * pageSize < total;
    return rowCount >= pageSize;
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
