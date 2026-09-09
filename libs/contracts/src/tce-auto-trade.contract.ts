export type TceCapitalPoolId = 'A' | 'B' | 'C';

export type TceOrderSide = 'BUY' | 'SELL';
export type TceOrderState =
  | 'PLANNED'
  | 'READY'
  | 'SUBMITTED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCEL_PENDING'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'UNKNOWN';

export type TcePositionState =
  | 'NONE'
  | 'BUY_PENDING'
  | 'HOLDING'
  | 'EX_DIVIDEND'
  | 'T2_PENDING'
  | 'AVAILABLE'
  | 'EXIT_PENDING'
  | 'CLOSED'
  | 'ORPHANED';

export type TceSlotState = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'RECYCLING' | 'BLOCKED';

export type TceDividendLifecycle =
  | 'UNKNOWN'
  | 'ANNOUNCED'
  | 'ELIGIBLE'
  | 'EX_DIVIDEND'
  | 'T2_PENDING'
  | 'DIVIDEND_CONFIRMED'
  | 'MISSED'
  | 'INVALIDATED';

export type TceEngineState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'PAUSED' | 'STOPPING' | 'ERROR';

export type TceActor = 'ENGINE' | 'USER' | 'SCHEDULER' | 'PROVIDER' | 'SYSTEM';

export type TceDividendEvent = {
  id: string;
  symbol: string;
  dividendType: 'CASH' | 'STOCK' | 'OTHER';
  dividendValue?: number;
  dividendYield?: number;
  announcementAt?: string;
  exDividendAt: string;
  recordAt?: string;
  paymentAt?: string;
  eligibility?: string[];
  source: string;
  sourceVersion?: string;
};

export type TceCandidate = {
  id: string;
  symbol: string;
  dividendEventId: string;
  observedAt: string;
  price: number;
  score: number;
  expectedReturn?: number;
  dividendContribution?: number;
  riskScore?: number;
  reasons: readonly string[];
  invalidationReasons?: readonly string[];
  scannerVersion: string;
};

export type TceCapitalPool = {
  pool: TceCapitalPoolId;
  configuredCapital: number;
  allocatedCapital: number;
  reservedCapital: number;
  availableCapital: number;
  realizedCapital: number;
  totalSlots: number;
  occupiedSlots: number;
};

export type TceSlot = {
  id: string;
  pool: TceCapitalPoolId;
  slot: number;
  state: TceSlotState;
  candidateId?: string;
  positionId?: string;
  reservedCapital?: number;
  updatedAt: string;
};

export type TceDecision = {
  id: string;
  candidateId: string;
  symbol: string;
  action: 'BUY' | 'HOLD' | 'REJECT';
  pool: TceCapitalPoolId;
  slotId: string;
  entry: number;
  target: number;
  invalidation?: number;
  confidence: number;
  reasons: readonly string[];
  strategyVersion: string;
  decidedAt: string;
};

export type TceOrderPlan = {
  id: string;
  decisionId: string;
  symbol: string;
  side: TceOrderSide;
  quantity: number;
  entryPrice: number;
  targetPrice?: number;
  invalidationPrice?: number;
  notional: number;
  pool: TceCapitalPoolId;
  slotId: string;
  createdAt: string;
};

export type TceExecutionIntent = {
  id: string;
  orderPlanId: string;
  correlationId: string;
  idempotencyKey: string;
  mode: 'PAPER' | 'ASSISTED' | 'LIVE';
  symbol: string;
  side: TceOrderSide;
  quantity: number;
  limitPrice?: number;
  lifecycleState: 'READY' | 'EXIT_READY';
  createdAt: string;
};

export type TceOrder = {
  id: string;
  executionIntentId: string;
  symbol: string;
  side: TceOrderSide;
  quantity: number;
  filledQuantity: number;
  state: TceOrderState;
  providerOrderId?: string;
  clientOrderId?: string;
  submittedAt?: string;
  updatedAt: string;
};

export type TcePosition = {
  id: string;
  symbol: string;
  pool: TceCapitalPoolId;
  slotId: string;
  quantity: number;
  entryPrice?: number;
  currentPrice?: number;
  targetPrice?: number;
  state: TcePositionState;
  sellableAt?: string;
  dividendLifecycle: TceDividendLifecycle;
  updatedAt: string;
};

export type TceEngine = {
  id: string;
  strategy: string;
  strategyVersion: string;
  mode: 'PAPER' | 'ASSISTED' | 'LIVE';
  state: TceEngineState;
  updatedAt: string;
};

export type TceLifecycleAudit = {
  id: string;
  entityId: string;
  entityType: 'CANDIDATE' | 'DECISION' | 'SLOT' | 'ORDER' | 'POSITION' | 'ENGINE';
  fromState?: string;
  toState: string;
  correlationId: string;
  idempotencyKey?: string;
  actor: TceActor;
  reason?: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
};

export type TceMutationIdentity = {
  correlationId: string;
  idempotencyKey: string;
};
