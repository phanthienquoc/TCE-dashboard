export type TcePosition = {
  symbol: string;
  quantity: number;
  avgCost: number;
  costBasis: number;
  status: 'OPEN' | 'CLOSED';
};

export type TceOrder = {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: string;
};

export * from './scanner/hunting-dividend-scanner';
export * from './decision/hunting-dividend.engine';
export * from './capital/capital-slot-allocator';
export * from './capital/capital-allocation-lifecycle';
export * from './order/order-planner';
export * from './order/order-planner-allocation';
export * from './order/order-precision';
export * from './order/order-planner-validation';
export * from './risk/risk-safety-gate';
export * from './risk/guarded-execution';
export * from './risk/risk-gate-audit';
export * from './execution/execution-orchestrator';
export * from './execution/trading-authorization';
export * from './execution/paper-execution';
export * from './execution/assisted-approval';
export * from './reconciliation/order-status';
