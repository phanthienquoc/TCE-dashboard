import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class PostgresService implements OnModuleDestroy {
  private pool: Pool | null = null;

  get configured(): boolean {
    return Boolean(process.env.DATABASE_URL);
  }

  private getPool(): Pool {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL_MISSING');
    }

    if (!this.pool) {
      const parsedMax = Number(process.env.DB_POOL_MAX ?? 5);
      const max = Number.isInteger(parsedMax) && parsedMax >= 1 && parsedMax <= 20
        ? parsedMax
        : 5;

      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        application_name: 'microfe-auth',
      });
      this.pool.on('error', () => {
        // Do not log connection errors with connection details or secrets.
      });
    }

    return this.pool;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.getPool().query<T>(sql, values as unknown[]);
  }

  async transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await run(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async checkConnection(): Promise<void> {
    await this.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
