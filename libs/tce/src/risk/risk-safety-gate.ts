import type {
  TceRiskGateConfig,
  TceRiskGateRequest,
  TceRiskGateResult,
} from '@tce/contracts';

function invalid(message: string): TceRiskGateResult {
  return { ok: false, code: 'INVALID_RISK_GATE_INPUT', message };
}

function validateConfig(config: TceRiskGateConfig): TceRiskGateResult | undefined {
  if (!Number.isFinite(config.maxRiskPerTrade) || config.maxRiskPerTrade <= 0) {
    return invalid('maxRiskPerTrade must be positive');
  }
  if (!Number.isFinite(config.maxConcurrentExposure) || config.maxConcurrentExposure <= 0) {
    return invalid('maxConcurrentExposure must be positive');
  }
  if (!Number.isFinite(config.maxIntentAgeMs) || config.maxIntentAgeMs < 0) {
    return invalid('maxIntentAgeMs must be non-negative');
  }
  if (config.maxMarketDataAgeMs !== undefined && (!Number.isFinite(config.maxMarketDataAgeMs) || config.maxMarketDataAgeMs < 0)) {
    return invalid('maxMarketDataAgeMs must be non-negative when configured');
  }
  if (config.maxDividendDataAgeMs !== undefined && (!Number.isFinite(config.maxDividendDataAgeMs) || config.maxDividendDataAgeMs < 0)) {
    return invalid('maxDividendDataAgeMs must be non-negative when configured');
  }
}

function hasOverride(request: TceRiskGateRequest): boolean {
  const override = request.override;
  return Boolean(
    override?.approved === true &&
    override.actor.trim() &&
    override.reason.trim() &&
    override.approvedAt.trim()
  );
}

function validateFreshness(
  now: number,
  observedAt: string | undefined,
  maxAgeMs: number | undefined,
  code: string,
  label: string
): TceRiskGateResult | undefined {
  if (maxAgeMs === undefined) return undefined;
  if (!observedAt) return { ok: false, code, message: `${label} timestamp is required` };
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(observed) || now < observed || now - observed > maxAgeMs) {
    return { ok: false, code, message: `${label} data is stale or has an invalid timestamp` };
  }
}

export function evaluateRiskSafetyGate(
  request: TceRiskGateRequest,
  config: TceRiskGateConfig
): TceRiskGateResult {
  const configError = validateConfig(config);
  if (configError) return configError;

  const { intent, context } = request;
  if (!intent.id.trim() || !intent.orderPlanId.trim() || !intent.correlationId.trim()) {
    return invalid('Execution intent identity is required');
  }
  if (intent.lifecycleState !== 'READY') {
    return { ok: false, code: 'INTENT_NOT_READY', message: 'Only READY execution intents can pass the entry risk gate' };
  }
  if (!Number.isFinite(intent.quantity) || intent.quantity <= 0) {
    return { ok: false, code: 'INVALID_QUANTITY', message: 'Execution quantity must be positive' };
  }
  if (!Number.isFinite(intent.limitPrice) || (intent.limitPrice ?? 0) <= 0) {
    return { ok: false, code: 'INVALID_PRICE', message: 'Execution limit price must be positive' };
  }
  if (!Number.isFinite(request.riskAmount) || request.riskAmount <= 0) {
    return { ok: false, code: 'UNCLEAR_RISK', message: 'Risk amount must be positive and finite' };
  }
  if (!Number.isFinite(context.availableCapital) || context.availableCapital < 0) {
    return invalid('Available capital must be finite and non-negative');
  }
  if (!Number.isFinite(context.concurrentExposure) || context.concurrentExposure < 0) {
    return invalid('Concurrent exposure must be finite and non-negative');
  }

  const now = Date.parse(context.now);
  const createdAt = Date.parse(intent.createdAt);
  if (!Number.isFinite(now) || !Number.isFinite(createdAt)) {
    return { ok: false, code: 'STALE_INTENT', message: 'Intent and gate timestamps must be valid' };
  }
  const ageMs = now - createdAt;
  if (ageMs < 0 || ageMs > config.maxIntentAgeMs) {
    return { ok: false, code: 'STALE_INTENT', message: 'Execution intent is stale for the current risk check' };
  }

  const marketFreshness = validateFreshness(now, context.marketDataAt, config.maxMarketDataAgeMs, 'STALE_MARKET_DATA', 'Market');
  if (marketFreshness) return marketFreshness;
  if (context.dividendDataRequired) {
    const dividendFreshness = validateFreshness(now, context.dividendDataAt, config.maxDividendDataAgeMs ?? 0, 'STALE_DIVIDEND_DATA', 'Dividend');
    if (dividendFreshness) return dividendFreshness;
  }

  if (config.blockOnMajorNews && context.majorNewsRisk) {
    return { ok: false, code: 'MAJOR_NEWS_RISK', message: 'Major-news protection is active' };
  }
  if (context.engineKillSwitch) {
    return { ok: false, code: 'ENGINE_KILL_SWITCH', message: 'Global engine kill switch is active' };
  }
  if (context.killedPools.includes(request.pool)) {
    return { ok: false, code: 'POOL_KILL_SWITCH', message: `Pool ${request.pool} kill switch is active` };
  }

  const notional = intent.quantity * (intent.limitPrice ?? 0);
  if (!Number.isFinite(notional) || notional <= 0) {
    return { ok: false, code: 'INVALID_NOTIONAL', message: 'Execution notional must be positive and finite' };
  }
  if (notional > context.availableCapital) {
    return { ok: false, code: 'BUYING_POWER_EXCEEDED', message: 'Execution notional exceeds available capital' };
  }

  const symbol = intent.symbol.trim().toUpperCase();
  if (!symbol) return invalid('Execution symbol is required');
  if (context.blockedSymbols.some((item) => item.trim().toUpperCase() === symbol)) {
    return { ok: false, code: 'SYMBOL_BLOCKED', message: `Symbol ${symbol} is blocked` };
  }
  if (context.allowedSymbols && !context.allowedSymbols.some((item) => item.trim().toUpperCase() === symbol)) {
    return { ok: false, code: 'SYMBOL_NOT_ALLOWED', message: `Symbol ${symbol} is not in the allow-list` };
  }

  if (context.concurrentExposure + notional > config.maxConcurrentExposure) {
    return { ok: false, code: 'MAX_CONCURRENT_EXPOSURE', message: 'Execution would exceed maximum concurrent exposure' };
  }

  const poolExposure = context.poolExposure[request.pool] ?? 0;
  if (!Number.isFinite(poolExposure) || poolExposure < 0) {
    return invalid(`Pool ${request.pool} exposure must be finite and non-negative`);
  }
  if (poolExposure + notional > config.maxConcurrentExposure) {
    return { ok: false, code: 'POOL_EXPOSURE_EXCEEDED', message: `Pool ${request.pool} exposure would exceed the configured exposure ceiling` };
  }

  const override = hasOverride(request);
  if (request.override && !override) {
    return { ok: false, code: 'INVALID_MANUAL_OVERRIDE', message: 'Manual override requires actor, reason, approval timestamp, and approved=true' };
  }
  if (request.riskAmount > config.maxRiskPerTrade && !override) {
    return { ok: false, code: 'MAX_RISK_EXCEEDED', message: 'Trade risk exceeds the configured maximum' };
  }

  return { ok: true, intent, riskAmount: request.riskAmount, overrideApplied: override };
}
