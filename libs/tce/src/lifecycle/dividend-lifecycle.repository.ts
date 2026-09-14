import type { TceDividendLifecycle } from '@tce/contracts';

export type TceDividendLifecycleRecord = {
  accountId: string;
  environment: string;
  symbol: string;
  eventId: string;
  lifecycle: TceDividendLifecycle;
  exDividendAt: string;
  recordAt?: string;
  paymentAt?: string;
  source: string;
  sourceVersion?: string;
  updatedAt: string;
};

export interface TceDividendLifecycleRepository {
  get(accountId: string, environment: string, eventId: string): Promise<TceDividendLifecycleRecord | undefined>;
  save(record: TceDividendLifecycleRecord): Promise<TceDividendLifecycleRecord>;
}
