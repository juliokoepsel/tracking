import { registerAs } from '@nestjs/config';

// Database configuration - constructs URI from individual env vars
export const databaseConfig = registerAs('database', () => {
  const user = process.env.MONGO_ROOT_USER || 'deliveryuser';
  const password = process.env.MONGO_ROOT_PASSWORD || 'deliverypassword';
  const host = process.env.MONGO_HOST || 'localhost';
  const port = process.env.MONGO_PORT || '27017';
  const db = process.env.MONGO_DB || 'delivery_tracking';

  return {
    uri: `mongodb://${user}:${password}@${host}:${port}/${db}?authSource=admin`,
  };
});
