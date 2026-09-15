import { Injectable, Logger } from '@nestjs/common';
import puppeteer, { type Browser } from 'puppeteer';

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
type BrowserSession = { browser: Browser; requestBody: string; cookieHeader: string; referer: string };

const BASE_URL = 'https://finance.vietstock.vn';
const EVENTS_PAGE = '/lich-su-kien.htm';
const EVENTS_API = '/data/eventstransferdata';
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
      // The browser is only used to establish a Vietstock session. Disable page
      // JavaScript so background navigation cannot detach the frame while we
      // are extracting the server-rendered verification token and cookies.
      await page.setJavaScriptEnabled(false);

      const url = new URL(EVENTS_PAGE, BASE_URL);
      url.searchParams.set('group', String(GROUP));
      url.searchParams.set('exchange', String(EXCHANGE));
      url.searchParams.set('fromDate', this.toVietstockDate(fromDate));
      url.searchParams.set('toDate', this.toVietstockDate(toDate));
      url.searchParams.set('page', '1');
      url.searchParams.set('tab', '1');

      const response = await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
      const html = response ? await response.text() : await page.content();
      const token = this.extractVerificationToken(html);
      if (!token) throw new Error('Vietstock events verification token not found');

      const cookies = await page.cookies();
      const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      if (!cookieHeader) throw new Error('Vietstock events session cookies not found');

      const body = new URLSearchParams({
        transferTypeID: '0',
        stockCode: '',
        fDate: fromDate,
        tDate: toDate,
        page: '1',
        pageSize: String(PAGE_SIZE),
        orderBy: 'EventID',
        orderDir: 'DESC',
        __RequestVerificationToken: token,
      });

      return {
        browser,
        requestBody: body.toString(),
        cookieHeader,
        referer: url.toString(),
      };
    } catch (error) {
      await browser.close().catch(() => undefined);
      throw error;
    }
  }

  private async fetchPage(pageNumber: number, session: BrowserSession): Promise<VietstockPage> {
    const params = new URLSearchParams(session.requestBody);
    params.set('page', String(pageNumber));

    const response = await fetch(new URL(EVENTS_API, BASE_URL), {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': USER_AGENT,
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.7',
        Cookie: session.cookieHeader,
        Referer: session.referer,
        Origin: BASE_URL,
      },
      body: params.toString(),
    });

    const text = await response.text();
    if (!response.ok) throw new Error(`Vietstock events API HTTP ${response.status}`);
    return this.parseApiResponse(text);
  }

  private extractVerificationToken(html: string): string {
    const inputMatches = [
      /<input\b[^>]*\bname=["']__RequestVerificationToken["'][^>]*\bvalue=["']([^"']+)["'][^>]*>/i,
      /<input\b[^>]*\bvalue=["']([^"']+)["'][^>]*\bname=["']__RequestVerificationToken["'][^>]*>/i,
      /<input\b[^>]*\bid=["']__RequestVerificationToken["'][^>]*\bvalue=["']([^"']+)["'][^>]*>/i,
      /<input\b[^>]*\bvalue=["']([^"']+)["'][^>]*\bid=["']__RequestVerificationToken["'][^>]*>/i,
    ];
    for (const pattern of inputMatches) {
      const match = html.match(pattern);
      if (match?.[1]) return match[1];
    }
    return '';
  }

  private parseApiResponse(text: string): VietstockPage {
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { const rows = this.parseHtmlRows(text); return { rows, hasMore: rows.length >= PAGE_SIZE, total: null }; }
    if (Array.isArray(payload)) return { rows: payload, hasMore: payload.length >= PAGE_SIZE, total: null };
    if (!payload || typeof payload !== 'object') return { rows: [], hasMore: false, total: null };
    const value = payload as Record<string, unknown>;
    const rows = this.firstArray(value, ['data', 'Data', 'items', 'Items', 'aaData', 'rows', 'Rows']);
    const total = this.firstNumber(value, ['recordsFiltered', 'RecordsFiltered', 'recordsTotal', 'RecordsTotal', 'total', 'Total', 'iTotalDisplayRecords']);
    return { rows, hasMore: total != null ? rows.length > 0 : rows.length >= PAGE_SIZE, total };
  }

  private parseRows(rows: unknown[]): CrawledStockEvent[] {
    const parsed: CrawledStockEvent[] = [];
    for (const row of rows) {
      const data = this.normalizeRow(row);
      const symbol = this.pick(data, ['Mã CK', 'Mã chứng khoán', 'Code', 'StockCode', 'stockCode', 'Symbol', 'symbol']).toUpperCase();
      const eventContent = this.pick(data, ['Nội dung sự kiện', 'EventContent', 'EventName', 'Content', 'eventContent']);
      const exRightDate = this.parseAnyDate(this.pick(data, ['Ngày GDKHQ', 'ExRightDate', 'ExDate', 'GDKHQDate', 'exRightDate']));
      if (!symbol || !exRightDate) continue;
      parsed.push({ mongoId: `${symbol}:${exRightDate}:${eventContent}`, symbol, exchange: this.pick(data, ['Sàn', 'Sàn GD', 'Exchange', 'exchange']) || null, exRightDate, recordDate: this.parseAnyDate(this.pick(data, ['Ngày ĐKCC', 'RecordDate', 'recordDate'])), paymentDate: this.parseAnyDate(this.pick(data, ['Ngày thực hiện', 'PaymentDate', 'paymentDate'])), gdkhqTimestamp: `${exRightDate}T00:00:00.000Z`, eventContent, ratioText: this.pick(data, ['Tỷ lệ', 'Ratio', 'RatioText', 'ratioText']), dividendValue: this.parseDividendValue(eventContent), referencePrice: this.parseNumber(this.pick(data, ['Giá tham chiếu', 'ReferencePrice', 'referencePrice'])), rawData: data, crawledAt: new Date().toISOString() });
    }
    return parsed;
  }
  private normalizeRow(row: unknown): Record<string, string> {
    if (row && typeof row === 'object' && !Array.isArray(row)) return Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([key, value]) => [key, this.clean(String(value ?? ''))]));
    if (typeof row === 'string') return this.parseHtmlRow(row);
    return {};
  }
  private parseHtmlRows(html: string) { const table = html.match(/<table[^>]*id=["']event-content["'][^>]*>([\s\S]*?)<\/table>/i)?.[0]; if (!table) return []; const matches = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(match => match[1]); if (matches.length < 2) return []; const headers = this.cells(matches[0]).map(cell => this.clean(this.stripTags(cell).replace(/[▼▲]/g, ''))); return matches.slice(1).map(row => { const cells = this.cells(row); return Object.fromEntries(headers.map((header, index) => [header, this.clean(this.stripTags(cells[index] ?? ''))])); }); }
  private parseHtmlRow(html: string) { const cells = this.cells(html).map(cell => this.clean(this.stripTags(cell))); return Object.fromEntries(cells.map((value, index) => [`column${index}`, value])); }
  private cells(rowHtml: string) { return [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => match[1]); }
  private stripTags(value: string) { return value.replace(/<br\s*\/?>(?=.)/gi, ' ').replace(/<[^>]+>/g, ' '); }
  private clean(value: string) { return value.replace(/&nbsp;/gi, ' ').replace(/&#x27;/gi, "'").replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim(); }
  private firstArray(value: Record<string, unknown>, keys: string[]) { for (const key of keys) if (Array.isArray(value[key])) return value[key] as unknown[]; return []; }
  private firstNumber(value: Record<string, unknown>, keys: string[]) { for (const key of keys) { const number = Number(value[key]); if (Number.isFinite(number)) return number; } return null; }
  private pick(data: Record<string, string>, keys: string[]) { for (const key of keys) if (data[key]) return data[key]; return ''; }
  private parseDividendValue(content: string) { const match = content.match(/(\d{1,3}(?:[,.]\d{3})*)\s*đồng\/CP/i); return match ? Number(match[1].replace(/[,.]/g, '')) : null; }
  private parseNumber(value?: string) { if (!value) return null; const normalized = value.replace(/,/g, '').replace(/[^0-9.-]/g, ''); const parsed = Number(normalized); return Number.isFinite(parsed) ? parsed : null; }
  private parseAnyDate(value?: string) { if (!value) return null; const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/); if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`; const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (!match) return null; return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`; }
  private toVietstockDate(value: string) { const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/); return match ? `${match[3]}/${match[2]}/${match[1]}` : value; }
  private today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
}
