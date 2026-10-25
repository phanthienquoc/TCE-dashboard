import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';

const DEFAULT_DB_NAME = 'vietstock';

@Injectable()
export class MongoDbClient implements OnModuleDestroy {
  private readonly logger = new Logger(MongoDbClient.name);
  private client: MongoClient | null = null;
  private database: Db | null = null;
  private connecting: Promise<Db> | null = null;

  async getDb(): Promise<Db> {
    if (this.database) return this.database;
    if (this.connecting) return this.connecting;

    const uri = process.env.MONGO_URI?.trim();
    if (!uri) {
      throw new Error('MONGO_URI is not configured');
    }

    const dbName = process.env.MONGO_DB_NAME?.trim() || DEFAULT_DB_NAME;
    this.connecting = this.connect(uri, dbName);

    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async connect(uri: string, dbName: string): Promise<Db> {
    const client = new MongoClient(uri, {
      appName: 'tce-service',
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    await client.db(dbName).command({ ping: 1 });

    this.client = client;
    this.database = client.db(dbName);
    this.logger.log(`MongoDB connected: ${dbName}`);
    return this.database;
  }

  async onModuleDestroy() {
    if (!this.client) return;
    await this.client.close();
    this.client = null;
    this.database = null;
    this.logger.log('MongoDB connection closed');
  }
}
