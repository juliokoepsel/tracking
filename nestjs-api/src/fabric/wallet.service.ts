import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WalletIdentity, WalletIdentityDocument } from './schemas/wallet-identity.schema';
import { FabricIdentity } from './fabric.types';

@Injectable()
export class WalletService implements OnModuleDestroy {
  private readonly logger = new Logger(WalletService.name);
  private cache = new Map<string, FabricIdentity>();

  constructor(
    @InjectModel(WalletIdentity.name)
    private walletModel: Model<WalletIdentityDocument>,
  ) {}

  async onModuleDestroy() {
    this.cache.clear();
  }

  /**
   * Store an identity in the MongoDB-backed wallet
   */
  async put(
    userId: string,
    mspId: string,
    certificate: string,
    privateKey: string,
    organization: string,
    enrollmentId?: string,
  ): Promise<void> {
    await this.walletModel.findOneAndUpdate(
      { userId },
      {
        userId,
        mspId,
        certificate,
        privateKey,
        organization,
        enrollmentId: enrollmentId || userId,
        isRevoked: false,
      },
      { upsert: true, new: true },
    );

    // Update cache
    this.cache.set(userId, { mspId, certificate, privateKey });

    this.logger.log(`Stored identity for user: ${userId} (${mspId})`);
  }

  /**
   * Retrieve an identity from the wallet
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

    const fabricIdentity: FabricIdentity = {
      mspId: identity.mspId,
      certificate: identity.certificate,
      privateKey: identity.privateKey,
    };

    // Cache it
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
