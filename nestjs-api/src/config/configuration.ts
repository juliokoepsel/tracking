import { registerAs } from '@nestjs/config';

// Database configuration - uses MONGODB_URI if set, otherwise constructs from individual env vars
export const databaseConfig = registerAs('database', () => {
  // Check for full URI first (used in docker-compose)
  const mongodbUri = process.env.MONGODB_URI;
  if (mongodbUri) {
    return { uri: mongodbUri };
  }

  // Fall back to constructing URI from individual env vars (for local dev)
  const user = process.env.MONGO_ROOT_USER || 'deliveryuser';
  const password = process.env.MONGO_ROOT_PASSWORD || 'deliverypassword';
  const host = process.env.MONGO_HOST || 'localhost';
  const port = process.env.MONGO_PORT || '27017';
  const db = process.env.MONGO_DB || 'delivery_tracking';

  return {
    uri: `mongodb://${user}:${password}@${host}:${port}/${db}?authSource=admin`,
  };
});
