import { useStockEventStore } from './stock-event-store';

export type StockEventReadOptions = {
  limit: number;
  force: boolean;
  month: string | null;
};

export type StockEventLoader = (
  limit: number,
  force: boolean,
  month: string | null,
  signal: AbortSignal
) => Promise<void>;

/**
 * Start a stock-event read and return the effect cleanup for its caller-owned signal.
 * The store remains responsible for request deduplication and stale-response guards.
 */
export function startStockEventRead(
  options: StockEventReadOptions,
  load: StockEventLoader = useStockEventStore.getState().load
): () => void {
  const controller = new AbortController();
  void load(options.limit, options.force, options.month, controller.signal);
  return () => controller.abort();
}
