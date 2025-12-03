import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { WalletIdentity, WalletIdentityDocument, EncryptedKey } from './schemas/wallet-identity.schema';
import { FabricIdentity } from './fabric.types';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const SALT = 'fabric-wallet-encryption-salt'; // Static salt (key is already high-entropy)

@Injectable()
export class WalletService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WalletService.name);
  private cache = new Map<string, FabricIdentity>();
  private encryptionKey: Buffer | null = null;

  constructor(
    @InjectModel(WalletIdentity.name)
    private walletModel: Model<WalletIdentityDocument>,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Derive encryption key from environment variable
    const keyMaterial = this.configService.get<string>('WALLET_ENCRYPTION_KEY');
    if (!keyMaterial) {
      this.logger.warn(
        'WALLET_ENCRYPTION_KEY not set! Using default key. ' +
        'THIS IS INSECURE - set a strong key in production!',
      );
      // Use a default key for development (32 bytes hex = 64 chars)
      this.encryptionKey = scryptSync('default-dev-key-change-in-production', SALT, KEY_LENGTH);
    } else {
      // Derive a proper 256-bit key using scrypt
      this.encryptionKey = scryptSync(keyMaterial, SALT, KEY_LENGTH);
    }
    this.logger.log('Wallet encryption initialized');
  }

  async onModuleDestroy() {
    this.cache.clear();
    // Zero out the key in memory
    if (this.encryptionKey) {
      this.encryptionKey.fill(0);
      this.encryptionKey = null;
    }
  }

  /**
   * Encrypt a private key using AES-256-GCM
   */
  private encryptPrivateKey(privateKey: string): EncryptedKey {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
      cipher.update(privateKey, 'utf8'),
      cipher.final(),
    ]);

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      algorithm: ENCRYPTION_ALGORITHM,
    };
  }

  /**
   * Decrypt a private key using AES-256-GCM
   */
  private decryptPrivateKey(encryptedKey: EncryptedKey): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      Buffer.from(encryptedKey.iv, 'base64'),
      { authTagLength: AUTH_TAG_LENGTH },
    );

    decipher.setAuthTag(Buffer.from(encryptedKey.authTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedKey.ciphertext, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Store an identity in the MongoDB-backed wallet (encrypted)
   */
  async put(
    userId: string,
    mspId: string,
    certificate: string,
    privateKey: string,
    organization: string,
    enrollmentId?: string,
  ): Promise<void> {
    // Encrypt the private key before storage
    const encryptedPrivateKey = this.encryptPrivateKey(privateKey);

    await this.walletModel.findOneAndUpdate(
      { userId },
      {
        userId,
        mspId,
        certificate,
        encryptedPrivateKey,
        organization,
        enrollmentId: enrollmentId || userId,
        isRevoked: false,
      },
      { upsert: true, new: true },
    );

    // Update cache with decrypted key (memory only)
    this.cache.set(userId, { mspId, certificate, privateKey });

    this.logger.log(`Stored encrypted identity for user: ${userId} (${mspId})`);
  }

  /**
   * Retrieve an identity from the wallet (decrypted)
   */
  async get(userId: string): Promise<FabricIdentity | null> {
    // Check cache first
    if (this.cache.has(userId)) {
      return this.cache.get(userId)!;
    }

    const identity = await this.walletModel.findOne({
      userId,
      isRevoked: false,
    });

    if (!identity) {
      return null;
    }

    // Decrypt the private key
    const privateKey = this.decryptPrivateKey(identity.encryptedPrivateKey);

    const fabricIdentity: FabricIdentity = {
      mspId: identity.mspId,
      certificate: identity.certificate,
      privateKey,
    };

    // Cache it (decrypted, in memory only)
    this.cache.set(userId, fabricIdentity);

    return fabricIdentity;
  }

  /**
   * Check if identity exists
   */
  async exists(userId: string): Promise<boolean> {
    if (this.cache.has(userId)) {
      return true;
    }

    const count = await this.walletModel.countDocuments({
      userId,
      isRevoked: false,
    });

    return count > 0;
  }

  /**
   * Revoke an identity (soft delete)
   */
  async revoke(userId: string): Promise<void> {
    await this.walletModel.updateOne(
      { userId },
      { isRevoked: true },
    );

    this.cache.delete(userId);
    this.logger.log(`Revoked identity for user: ${userId}`);
  }

  /**
   * Delete an identity permanently
   */
  async remove(userId: string): Promise<void> {
    await this.walletModel.deleteOne({ userId });
    this.cache.delete(userId);
    this.logger.log(`Removed identity for user: ${userId}`);
  }

  /**
   * List all identities for an organization
   */
  async listByOrganization(organization: string): Promise<string[]> {
    const identities = await this.walletModel.find(
      { organization, isRevoked: false },
      { userId: 1 },
    );

    return identities.map((i) => i.userId);
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
