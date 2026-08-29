export type EngineId = 'tce-decision' | 'ssi-execution' | 'binance-market';

export type EngineDefinition = {
  id: EngineId;
  name: string;
  description: string;
  platform: string;
  category: string;
  defaults: Record<string, string | number | boolean>;
};

export const ENGINE_REGISTRY: EngineDefinition[] = [
  {
    id: 'tce-decision',
    name: 'TCE Decision Engine',
    description:
      'Evaluates positions and produces HOLD, WATCH, TAKE_PROFIT, CASHOUT, CUT and EXIT decisions.',
    platform: 'TCE',
    category: 'Decision',
    defaults: { takeProfitPct: 5, cashoutPct: 8, cutPct: -5 },
  },
  {
    id: 'ssi-execution',
    name: 'SSI Execution Engine',
    description:
      'Handles SSI session, OTP, portfolio sync and realtime order-status reconciliation.',
    platform: 'SSI',
    category: 'Execution',
    defaults: { orderStream: true, portfolioSync: true, reconcileFilledOrders: true },
  },
  {
    id: 'binance-market',
    name: 'Binance Market Engine',
    description:
      'Provides Binance market connectivity and realtime market data for supported workflows.',
    platform: 'Binance',
    category: 'Market Data',
    defaults: { realtimeQuotes: true, reconnectOnFailure: true, pollingSeconds: 15 },
  },
];

export function getEngine(id: string) {
  return ENGINE_REGISTRY.find(engine => engine.id === id);
}
