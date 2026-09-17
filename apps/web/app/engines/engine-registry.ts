export type EngineId = 'tce-decision' | 'ssi-execution' | 'binance-market' | 'binance-xau';

export type EngineDefinition = {
  id: EngineId;
  name: string;
  description: string;
  platform: string;
  category: string;
  defaults: Record<string, string | number | boolean>;
};

export const ENGINE_REGISTRY: EngineDefinition[] = [
  { id: 'tce-decision', name: 'TCE Decision Engine', description: 'Evaluates positions and produces strategy decisions for VN cash equities.', platform: 'TCE', category: 'Decision', defaults: { poolSize: 20, maxPositions: 2, coreCapital: 15_000_000, burstCapital: 5_000_000, profitTargetPct: 10, maxAssetAllocationPct: 40, buyQuantityStep: 100, buyFromRemainingBudget: true, monitorIntervalMinutes: 60, timezone: 'Asia/Ho_Chi_Minh', marketOpen: '09:00:00', marketClose: '14:45:00', autoSellEnabled: false, autoSellProfitTargetPct: 10, autoSellIntervalMinutes: 60 } },
  { id: 'ssi-execution', name: 'SSI Execution Engine', description: 'Handles SSI session, portfolio sync and realtime order-status reconciliation.', platform: 'SSI', category: 'Execution', defaults: { orderStream: true, portfolioSync: true, reconcileFilledOrders: true } },
  { id: 'binance-market', name: 'Binance Market Engine', description: 'Provides Binance market connectivity and realtime market data for supported workflows.', platform: 'Binance', category: 'Market Data', defaults: { realtimeQuotes: true, reconnectOnFailure: true, pollingSeconds: 15, orderQuantity: 0.01, positionSide: 'BOTH' } },
  { id: 'binance-xau', name: 'Binance XAU Futures', description: 'Consumes Telegram XAU signals and maintains TP/SL protection in realtime.', platform: 'Binance', category: 'Futures Execution', defaults: { symbol: 'XAUUSDT', tpPct: 5, slPct: 5, autoProtection: true } },
];

export function getEngine(id: string) { return ENGINE_REGISTRY.find(engine => engine.id === id); }
