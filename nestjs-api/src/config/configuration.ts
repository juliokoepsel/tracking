import { registerAs } from '@nestjs/config';

export const fabricConfig = registerAs('fabric', () => ({
  channelName: process.env.FABRIC_CHANNEL_NAME || 'deliverychannel',
  chaincodeName: process.env.FABRIC_CHAINCODE_NAME || 'delivery',
  mspId: process.env.FABRIC_MSP_ID || 'DeliveryOrgMSP',
  peerEndpoint: process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051',
  caHost: process.env.FABRIC_CA_HOST || 'localhost',
  caPort: parseInt(process.env.FABRIC_CA_PORT || '7054', 10),
  cryptoPath: process.env.FABRIC_CRYPTO_PATH || './organizations',
  tlsEnabled: process.env.FABRIC_TLS_ENABLED !== 'false',
}));

export const databaseConfig = registerAs('database', () => ({
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/delivery_tracking',
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
}));

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
}));
