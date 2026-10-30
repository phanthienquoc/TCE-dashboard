import { useStockEventStore } from './stock-event-store';

type DividendEventLoader = (
  limit: number,
  force: boolean,
  month: null,
  signal: AbortSignal
) => Promise<void>;

/**
 * Start the full dividend-position event refresh and return its effect cleanup.
 * The store keeps ownership of request deduplication and stale-response guards;
 * this caller only cancels the read when its component lifecycle ends.
 */
export function startDividendPositionsEventRead(
  load: DividendEventLoader = useStockEventStore.getState().load
): () => void {
  const controller = new AbortController();
  void load(2000, true, null, controller.signal);
  return () => controller.abort();
}
