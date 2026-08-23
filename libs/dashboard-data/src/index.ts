export type DashboardSourceName = 'supabase' | 'ssi' | 'fastapi';

export type DashboardSource<T = unknown> = {
  readonly name: DashboardSourceName;
  isAvailable(context: { userId: string }): Promise<boolean>;
  get(context: { userId: string }): Promise<T>;
};

export type DashboardSourceResult<T> = {
  source: DashboardSourceName;
  available: boolean;
  data: T;
  fetchedAt: string;
  error?: string | null;
};

export type DashboardSnapshot = {
  account: Record<string, unknown>;
  positions: unknown[];
  orders: unknown[];
  pools: unknown[];
  nextPositions: unknown[];
  sources: DashboardSourceResult[];
};
