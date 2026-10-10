import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';

@Injectable()
export class PostgresService implements OnModuleDestroy {
  private readonly pool: Pool | null;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      this.pool = null;
      return;
    }
    const max = Number(process.env.DB_POOL_MAX ?? 5);
    this.pool = new Pool({
      connectionString,
      max: Number.isInteger(max) && max > 0 ? Math.min(max, 20) : 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      ssl: process.env.DB_SSL === 'disable' ? false : { rejectUnauthorized: true },
      application_name: 'microfe-auth',
    });
  }

  get configured(): boolean {
    return this.pool !== null;
  }

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
    if (!this.pool) throw new Error('DATABASE_URL_NOT_CONFIGURED');
    return this.pool.query<T>(sql, values);
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error('DATABASE_URL_NOT_CONFIGURED');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }
}
