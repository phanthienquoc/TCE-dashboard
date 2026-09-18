export type EngineId = 'tce-decision' | 'capital-rotation-decision' | 'ssi-execution' | 'binance-market' | 'binance-execution' | 'binance-derivatives' | 'binance-xau';

export type EngineDefinition = {
  id: EngineId;
  name: string;
  description: string;
  platform: string;
  category: string;
  layer: 'market-data' | 'decision' | 'execution' | 'derivatives';
  provider: string;
  defaults: Record<string, string | number | boolean>;
};

export const ENGINE_REGISTRY: EngineDefinition[] = [
  {
    id: 'tce-decision',
    name: 'TCE Decision Engine',
    description: 'Evaluates positions and produces strategy decisions for VN cash equities.',
    platform: 'TCE',
    category: 'Decision',
    layer: 'decision',
    provider: 'tce',
    defaults: { poolSize: 20, maxPositions: 2, coreCapital: 15_000_000, burstCapital: 5_000_000, profitTargetPct: 10, maxAssetAllocationPct: 40, buyQuantityStep: 100, buyFromRemainingBudget: true, monitorIntervalMinutes: 60, timezone: 'Asia/Ho_Chi_Minh', marketOpen: '09:00:00', marketClose: '14:45:00', autoSellEnabled: false, autoSellProfitTargetPct: 10, autoSellIntervalMinutes: 60 },
  },
  {
    id: 'capital-rotation-decision',
    name: 'Capital Rotation Decision Engine',
    description: 'Optimizes capital rotation across dividend capture, post-ex-dividend recovery and capital turnover opportunities for VN cash equities.',
    platform: 'TCE',
    category: 'Decision',
    layer: 'decision',
    provider: 'tce',
    defaults: {
      poolSize: 20,
      maxPositions: 2,
      coreCapital: 15_000_000,
      burstCapital: 5_000_000,
      maxAssetAllocationPct: 40,
      buyQuantityStep: 100,
      buyFromRemainingBudget: true,
      monitorIntervalMinutes: 60,
      timezone: 'Asia/Ho_Chi_Minh',
      marketOpen: '09:00:00',
      marketClose: '14:45:00',
      lookbackDays: 30,
      takeProfitPct: 5,
      minConfidence: 0.5,
      maxHoldDays: 30,
      slotsPerPool: 1,
      liveTradingEnabled: false,
    },
  },
  {
    id: 'ssi-execution',
    name: 'SSI Execution Engine',
    description: 'Handles SSI session, portfolio sync and realtime order-status reconciliation.',
    platform: 'SSI',
    category: 'Execution',
    layer: 'execution',
    provider: 'ssi',
    defaults: { orderStream: true, portfolioSync: true, reconcileFilledOrders: true },
  },
  {
    id: 'binance-market',
    name: 'Binance Market Engine',
    description: 'Provides Binance market connectivity and realtime market data for supported workflows.',
    platform: 'Binance',
    category: 'Market Data',
    layer: 'market-data',
    provider: 'binance',
    defaults: { realtimeQuotes: true, reconnectOnFailure: true, pollingSeconds: 15 },
  },
  {
    id: 'binance-execution',
    name: 'Binance Execution Engine',
    description: 'Provider-neutral execution capability for Binance Futures order submission, cancellation and reconciliation.',
    platform: 'Binance',
    category: 'Execution',
    layer: 'execution',
    provider: 'binance',
    defaults: { reconcileOpenOrders: true, idempotentClientOrderIds: true },
  },
  {
    id: 'binance-derivatives',
    name: 'Binance Derivatives Engine',
    description: 'Owns Binance Futures strategy orchestration, position reconciliation and XAU protection workflows.',
    platform: 'Binance',
    category: 'Derivatives',
    layer: 'derivatives',
    provider: 'binance',
    defaults: { symbol: 'XAUUSDT', tpPct: 5, slPct: 5, autoProtection: true },
  },
  {
    id: 'binance-xau',
    name: 'Binance XAU Futures (Legacy)',
    description: 'Compatibility alias for persisted Binance XAU engine configuration.',
    platform: 'Binance',
    category: 'Compatibility',
    layer: 'derivatives',
    provider: 'binance',
    defaults: { symbol: 'XAUUSDT', tpPct: 5, slPct: 5, autoProtection: true },
  },
];

export function getEngine(id: string) {
  return ENGINE_REGISTRY.find(engine => engine.id === id);
}
