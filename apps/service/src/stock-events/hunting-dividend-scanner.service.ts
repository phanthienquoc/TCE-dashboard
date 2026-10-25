import { Injectable } from '@nestjs/common';
import type { TceCandidate, TceDividendEvent } from '@tce/contracts';
import {
  HuntingDividendCandidateScanner,
  type HuntingDividendMarketSnapshot,
  type HuntingDividendScanRejectionReason,
} from '@tce/tce';
import { StockEventsService } from './stock-events.service';
import { normalizeTceDividendEvent } from './tce-dividend-event.normalizer';

export type HuntingDividendMarketInput = HuntingDividendMarketSnapshot;

export type HuntingDividendScanBatchResult = {
  candidates: readonly TceCandidate[];
  normalizedEvents: number;
  rejectedEvents: number;
  rejectedMarkets: number;
  rejectionReasons: Readonly<Record<HuntingDividendScanRejectionReason, number>>;
};

@Injectable()
export class HuntingDividendScannerService {
  private readonly scanner = new HuntingDividendCandidateScanner();

  constructor(private readonly stockEvents: StockEventsService) {}

  async scanUpcoming(
    markets: ReadonlyMap<string, HuntingDividendMarketInput>,
    limit = 100,
    now = new Date().toISOString()
  ): Promise<HuntingDividendScanBatchResult> {
    const rows = await this.stockEvents.getUpcoming(limit);
    return this.scanRows(rows, markets, now);
  }

  scanRows(
    rows: readonly unknown[],
    markets: ReadonlyMap<string, HuntingDividendMarketInput>,
    now: string
  ): HuntingDividendScanBatchResult {
    const inputs: Array<{
      dividend: TceDividendEvent;
      market: HuntingDividendMarketInput;
      now: string;
    }> = [];
    let normalizedEvents = 0;
    let rejectedEvents = 0;
    let rejectedMarkets = 0;
    const rejectionReasons: Partial<Record<HuntingDividendScanRejectionReason, number>> = {};

    for (const row of rows) {
      const dividend = normalizeTceDividendEvent(
        row as Parameters<typeof normalizeTceDividendEvent>[0]
      );
      if (!dividend) {
        rejectedEvents += 1;
        continue;
      }
      normalizedEvents += 1;

      const market = markets.get(dividend.symbol.toUpperCase());
      if (!market) {
        rejectedMarkets += 1;
        continue;
      }

      inputs.push({ dividend, market, now });
    }

    const candidates: TceCandidate[] = [];
    for (const input of inputs) {
      const result = this.scanner.scanDetailed(input);
      if (result.candidate) {
        candidates.push(result.candidate);
        continue;
      }
      for (const reason of result.rejectionReasons) {
        rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
      }
    }

    return {
      candidates: candidates.sort(
        (a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol) || a.id.localeCompare(b.id)
      ),
      normalizedEvents,
      rejectedEvents,
      rejectedMarkets,
      rejectionReasons: rejectionReasons as Readonly<
        Record<HuntingDividendScanRejectionReason, number>
      >,
    };
  }
}
