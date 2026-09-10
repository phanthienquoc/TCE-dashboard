export type OrderPlannerValidationConfig = Readonly<{
  lotSize: number;
  quantityStep?: number;
  priceTick?: number;
  minQuantity?: number;
  maxQuantity?: number;
  maxNotional?: number;
}>;

export type OrderPlannerValidationOutcome =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; code: string; message: string }>;

export function validateOrderPlannerConfig(
  config: OrderPlannerValidationConfig
): OrderPlannerValidationOutcome {
  if (!Number.isInteger(config.lotSize) || config.lotSize <= 0) {
    return { ok: false, code: 'INVALID_LOT_SIZE', message: 'lotSize must be a positive integer' };
  }
  if (config.quantityStep !== undefined && (!Number.isInteger(config.quantityStep) || config.quantityStep <= 0)) {
    return { ok: false, code: 'INVALID_QUANTITY_STEP', message: 'quantityStep must be a positive integer' };
  }
  if (config.priceTick !== undefined && (!Number.isFinite(config.priceTick) || config.priceTick <= 0)) {
    return { ok: false, code: 'INVALID_PRICE_TICK', message: 'priceTick must be positive and finite' };
  }
  if (config.minQuantity !== undefined && (!Number.isFinite(config.minQuantity) || config.minQuantity <= 0)) {
    return { ok: false, code: 'INVALID_MIN_QUANTITY', message: 'minQuantity must be positive and finite' };
  }
  if (config.maxQuantity !== undefined && (!Number.isFinite(config.maxQuantity) || config.maxQuantity <= 0)) {
    return { ok: false, code: 'INVALID_MAX_QUANTITY', message: 'maxQuantity must be positive and finite' };
  }
  if (config.minQuantity !== undefined && config.maxQuantity !== undefined && config.minQuantity > config.maxQuantity) {
    return { ok: false, code: 'INVALID_QUANTITY_RANGE', message: 'minQuantity cannot exceed maxQuantity' };
  }
  if (config.maxNotional !== undefined && (!Number.isFinite(config.maxNotional) || config.maxNotional <= 0)) {
    return { ok: false, code: 'INVALID_MAX_NOTIONAL', message: 'maxNotional must be positive and finite' };
  }
  return { ok: true };
}

export function validateBuyOrderPrices(
  entry: number,
  target: number | undefined,
  invalidation: number | undefined
): OrderPlannerValidationOutcome {
  if (!Number.isFinite(entry) || entry <= 0) {
    return { ok: false, code: 'INVALID_ENTRY_PRICE', message: 'Entry price must be positive and finite' };
  }
  if (target !== undefined && (!Number.isFinite(target) || target <= 0)) {
    return { ok: false, code: 'INVALID_TARGET_PRICE', message: 'Target price must be positive and finite' };
  }
  if (invalidation !== undefined && (!Number.isFinite(invalidation) || invalidation <= 0)) {
    return { ok: false, code: 'INVALID_INVALIDATION_PRICE', message: 'Invalidation price must be positive and finite' };
  }
  if (target !== undefined && target <= entry) {
    return { ok: false, code: 'INVALID_TARGET_RELATION', message: 'BUY target price must be above entry price' };
  }
  if (invalidation !== undefined && invalidation >= entry) {
    return { ok: false, code: 'INVALID_INVALIDATION_RELATION', message: 'BUY invalidation price must be below entry price' };
  }
  return { ok: true };
}
