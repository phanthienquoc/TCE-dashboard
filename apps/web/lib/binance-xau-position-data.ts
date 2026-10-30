import { platformApi } from './api';

export type BinanceXauPosition = {
  symbol: string;
  positionAmt: number;
  entryPrice: number;
  markPrice: number;
  unrealizedProfit: number;
  positionSide?: string;
};

/**
 * Read the current XAU position for the selected Binance environment.
 * The caller owns the signal and must ignore the result after its scope ends.
 */
export async function loadBinanceXauPosition(
  environment: 'production' | 'testnet',
  signal: AbortSignal
): Promise<BinanceXauPosition | null> {
  const response = await platformApi.binanceXauPositions(environment, signal);
  const rows = Array.isArray(response.data) ? (response.data as BinanceXauPosition[]) : [];
  return rows.find(item => item && Math.abs(Number(item.positionAmt)) > 0) ?? null;
}
