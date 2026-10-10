import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class PostgresService implements OnModuleDestroy {
  private readonly pool: Pool | null;

  constructor() {
    const rawConnectionString = process.env.DATABASE_URL;
    if (!rawConnectionString) {
      this.pool = null;
      return;
    }

    // Force verified TLS by default, even when the provided URL contains
    // sslmode=require. Local development can explicitly set DB_SSL=disable.
    const connectionUrl = new URL(rawConnectionString);
    for (const parameter of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) {
      connectionUrl.searchParams.delete(parameter);
    }
    const configuredMax = Number(process.env.DB_POOL_MAX || 5);
    const max = Number.isInteger(configuredMax) && configuredMax >= 1 && configuredMax <= 20
      ? configuredMax
      : 5;

    this.pool = new Pool({
      connectionString: connectionUrl.toString(),
      max,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      application_name: 'tce-service-auth',
      ssl: process.env.DB_SSL === 'disable' ? false : { rejectUnauthorized: true },
    });
  }

  async query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    values: unknown[] = []
  ): Promise<QueryResult<Row>> {
    return this.requirePool().query<Row>(sql, values);
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.requirePool().connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Keep the original database error.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  private requirePool(): Pool {
    if (!this.pool) {
      throw new Error('DATABASE_URL is required for PostgreSQL-backed auth transactions');
    }
    return this.pool;
  }
}
