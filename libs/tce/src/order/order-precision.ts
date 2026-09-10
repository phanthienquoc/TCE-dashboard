export type OrderPrecisionConfig = Readonly<{
  priceTick: number;
  quantityStep: number;
}>;

export type OrderPrecisionOutcome<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code: string; message: string }>;

export function roundPriceToTick(price: number, tick: number): OrderPrecisionOutcome<number> {
  if (!Number.isFinite(price) || price <= 0) return { ok: false, code: 'INVALID_PRICE', message: 'Price must be positive and finite' };
  if (!Number.isFinite(tick) || tick <= 0) return { ok: false, code: 'INVALID_PRICE_TICK', message: 'priceTick must be positive and finite' };
  const value = Math.floor((price / tick) + 1e-12) * tick;
  if (value <= 0) return { ok: false, code: 'INVALID_PRICE', message: 'Rounded price must be positive' };
  return { ok: true, value };
}

export function roundQuantityToStep(quantity: number, step: number): OrderPrecisionOutcome<number> {
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, code: 'INVALID_QUANTITY', message: 'Quantity must be positive and finite' };
  if (!Number.isInteger(step) || step <= 0) return { ok: false, code: 'INVALID_QUANTITY_STEP', message: 'quantityStep must be a positive integer' };
  const value = Math.floor(quantity / step) * step;
  if (value <= 0) return { ok: false, code: 'INSUFFICIENT_QUANTITY', message: 'Quantity cannot purchase one quantity step' };
  return { ok: true, value };
}

export function normalizeOrderPrices(
  entry: number,
  target: number | undefined,
  invalidation: number | undefined,
  config: OrderPrecisionConfig
): OrderPrecisionOutcome<Readonly<{ entry: number; target?: number; invalidation?: number }>> {
  const normalizedEntry = roundPriceToTick(entry, config.priceTick);
  if (!normalizedEntry.ok) return normalizedEntry;
  const normalizedTarget = target === undefined ? undefined : roundPriceToTick(target, config.priceTick);
  if (normalizedTarget && !normalizedTarget.ok) return normalizedTarget;
  const normalizedInvalidation = invalidation === undefined ? undefined : roundPriceToTick(invalidation, config.priceTick);
  if (normalizedInvalidation && !normalizedInvalidation.ok) return normalizedInvalidation;
  return {
    ok: true,
    value: {
      entry: normalizedEntry.value,
      target: normalizedTarget?.value,
      invalidation: normalizedInvalidation?.value,
    },
  };
}
