export const CONTRACT_TOKENS = {
  credentials: Symbol.for('tce.contracts.credentials'),
  tceAccountRepository: Symbol.for('tce.contracts.tceAccountRepository'),
  positionRepository: Symbol.for('tce.contracts.positionRepository'),
  orderRepository: Symbol.for('tce.contracts.orderRepository'),
  marketData: Symbol.for('tce.contracts.marketData'),
  broker: Symbol.for('tce.contracts.broker'),
} as const;
