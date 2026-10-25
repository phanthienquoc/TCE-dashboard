import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';
import { CapitalRotationPoolScorer } from '@tce/tce';

const DEFAULT_LIMIT = 20;
const DEFAULT_TABLE = 'tce_stock_event_market_metrics';

type StockEventRow = {
  id?: string | null;
  mongo_id?: string | null;
  symbol?: string | null;
  ex_right_date?: string | null;
  gdkhq_timestamp?: string | null;
  payment_date?: string | null;
  event_content?: string | null;
  ratio_text?: string | null;
  dividend_value?: number | string | null;
  reference_price?: number | string | null;
  current_price?: number | string | null;
  current_price_date?: string | null;
  dividend_yield_pct?: number | string | null;
  one_year_low?: number | string | null;
  one_year_high?: number | string | null;
};

@Injectable()
export class StockDividendPoolService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async getTop(limit = DEFAULT_LIMIT, month?: string) {
    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 20);
    const table = process.env.SUPABASE_EVENTS_TABLE?.trim() || DEFAULT_TABLE;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const selectedMonth =
      month && /^\d{4}-\d{2}$/.test(month)
        ? month
        : `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
    const [year, monthNumber] = selectedMonth.split('-').map(Number);
    const start = new Date(Date.UTC(year, monthNumber - 1, 1));
    const end = new Date(Date.UTC(year, monthNumber, 1));
    const rangeStart = start > today ? start : today;

    try {
      const { data, error } = await this.supabase.db
        .from(table)
        .select(
          'id,mongo_id,symbol,ex_right_date,gdkhq_timestamp,payment_date,event_content,ratio_text,dividend_value,reference_price,current_price,current_price_date,dividend_yield_pct,one_year_low,one_year_high'
        )
        .gte('gdkhq_timestamp', rangeStart.toISOString())
        .lt('gdkhq_timestamp', end.toISOString())
        .order('gdkhq_timestamp', { ascending: true })
        .limit(200);

      if (error) throw error;

      const scorer = new CapitalRotationPoolScorer({ size: safeLimit });
      const candidates = (data as StockEventRow[])
        .map(row => {
          const ticker = String(row.symbol ?? '').trim();
          const dividendValue = Number(row.dividend_value ?? 0);
          const price = Number(row.current_price ?? row.reference_price ?? 0);
          const yieldPct =
            row.dividend_yield_pct == null
              ? price > 0
                ? (dividendValue / price) * 100
                : 0
              : Number(row.dividend_yield_pct);
          const exDate = normalizeDate(row.ex_right_date ?? row.gdkhq_timestamp);
          const days = exDate
            ? Math.max(0, Math.ceil((new Date(exDate).getTime() - today.getTime()) / 86_400_000))
            : 999;
          return {
            id: String(row.mongo_id ?? row.id ?? ''),
            ticker,
            exDividendDate: row.ex_right_date ?? exDate ?? '',
            exDividendTimestamp: normalizeDate(row.gdkhq_timestamp),
            paymentDate: row.payment_date ?? null,
            eventContent: row.event_content ?? '',
            dividendRate: row.ratio_text ?? '',
            dividendValue,
            price: price || null,
            currentPrice: row.current_price == null ? null : Number(row.current_price),
            currentPriceDate: row.current_price_date ?? null,
            dividendYieldPct: Number(yieldPct.toFixed(2)),
            score: 0,
            daysToExDate: days,
            oneYearLow: row.one_year_low == null ? null : Number(row.one_year_low),
            oneYearHigh: row.one_year_high == null ? null : Number(row.one_year_high),
          };
        })
        .filter(row => row.ticker && row.exDividendDate);

      const ranked = scorer.rank(
        candidates.map(row => ({
          symbol: row.ticker,
          price: Number(row.currentPrice ?? row.price ?? 0),
          dividendValue: row.dividendValue,
          dividendYieldPct:
            row.dividendYieldPct ?? yieldPctFrom(row.dividendValue, row.currentPrice ?? row.price),
          exRightDate: row.exDividendDate,
          gdkhqTimestamp: row.exDividendTimestamp ?? undefined,
          paymentDate: row.paymentDate ?? undefined,
          dividendType: 'CASH',
          observedAt: row.currentPriceDate ?? row.exDividendTimestamp ?? new Date().toISOString(),
          oneYearLow: row.oneYearLow ?? undefined,
          oneYearHigh: row.oneYearHigh ?? undefined,
          dividendEventId: row.id,
        })),
        new Date().toISOString()
      );

      const rankedKeys = new Set(
        ranked.map(item => `${item.symbol.toUpperCase()}:${String(item.dividendEventId ?? '')}`)
      );

      return candidates
        .map(row => {
          const key = `${row.ticker.toUpperCase()}:${row.id}`;
          const item = ranked.find(
            candidate =>
              `${candidate.symbol.toUpperCase()}:${String(candidate.dividendEventId ?? '')}` === key
          );
          if (!item || !rankedKeys.has(key)) return null;
          return {
            ...row,
            score: item.poolScore,
            dividendScore: item.dividendScore,
            liquidityScore: item.liquidityScore,
            recoveryScore: item.recoveryScore,
            riskScore: item.riskScore,
            turnoverScore: item.turnoverScore,
            catalystScore: item.catalystScore,
            expectedReturnPct: item.expectedReturnPct,
            expectedHoldDays: item.expectedHoldDays,
            rationale: item.poolReason.join('|'),
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .sort((a, b) => b.score - a.score || a.daysToExDate - b.daysToExDate)
        .slice(0, safeLimit)
        .map((row, index) => ({ ...row, rank: index + 1 }));
    } catch (error) {
      throw new ServiceUnavailableException(
        `Stock dividend pool query failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

function yieldPctFrom(dividendValue: number, price: number | null): number {
  return Number.isFinite(dividendValue) && price && price > 0 ? (dividendValue / price) * 100 : 0;
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
