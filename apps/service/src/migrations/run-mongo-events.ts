import { migrateMongoEvents } from './mongo-events.migrator';

async function main() {
  const rawLimit = process.env.MONGO_EVENTS_MIGRATION_LIMIT?.trim();
  const limit = rawLimit ? Number(rawLimit) : undefined;

  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error('MONGO_EVENTS_MIGRATION_LIMIT must be a positive integer');
  }

  const result = await migrateMongoEvents({ limit });
  console.log(`MongoDB events migration complete: processed=${result.processed}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
