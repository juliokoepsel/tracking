import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';

import { FabricGatewayService } from '../fabric/fabric-gateway.service';
import { WalletService } from '../fabric/wallet.service';
import { UsersService } from '../users/users.service';
import { Delivery, DeliveryHistoryRecord } from './types/delivery.types';
import { UpdateLocationDto } from './dto/update-location.dto';
import { InitiateHandoffDto } from './dto/initiate-handoff.dto';
import { ConfirmHandoffDto } from './dto/confirm-handoff.dto';
import { DisputeHandoffDto } from './dto/dispute-handoff.dto';
import { DeliveryStatus, UserRole } from '../common/enums';

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);

  constructor(
    private fabricGatewayService: FabricGatewayService,
    private walletService: WalletService,
    private usersService: UsersService,
  ) {}

  /**
   * Generate a unique delivery ID
   */
  private generateDeliveryId(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = randomBytes(4).toString('hex').toUpperCase();
    return `DEL-${date}-${random}`;
  }

  /**
   * Ensure user has a blockchain identity
   */
  private async ensureIdentity(userId: string): Promise<void> {
    const hasIdentity = await this.walletService.exists(userId);
    if (!hasIdentity) {
      throw new BadRequestException('User does not have a blockchain identity. Please contact admin.');
    }
  }

  /**
   * Create a new delivery on the blockchain
   * Called when seller confirms an order
   * Note: sellerId in the blockchain will be extracted from the X.509 certificate
   */
  async createDelivery(
    sellerId: string,
    orderId: string,
    customerId: string,
    packageWeight: number,
    packageLength: number,
    packageWidth: number,
    packageHeight: number,
    city: string,
    state: string,
    country: string,
  ): Promise<string> {
    await this.ensureIdentity(sellerId);

    const deliveryId = this.generateDeliveryId();

    try {
      // Submit transaction using seller's X.509 identity
      // The chaincode extracts seller ID from the certificate's CN
      await this.fabricGatewayService.submitTransaction(
        sellerId,
        'CreateDelivery',
        deliveryId,
        orderId,
        customerId,
        packageWeight.toString(),
        packageLength.toString(),
        packageWidth.toString(),
        packageHeight.toString(),
        city,
        state,
        country,
      );

      this.logger.log(`Created delivery ${deliveryId} for order ${orderId}`);
      return deliveryId;
    } catch (error: any) {
      this.logger.error(`Failed to create delivery: ${error.message}`);
      throw new BadRequestException(`Failed to create delivery: ${error.message}`);
    }
  }

  /**
   * Read a delivery from the blockchain
   */
  async getDelivery(userId: string, deliveryId: string): Promise<Delivery> {
    await this.ensureIdentity(userId);

    try {
      const result = await this.fabricGatewayService.evaluateTransaction(
        userId,
        'ReadDelivery',
        deliveryId,
      );

      const resultStr = new TextDecoder().decode(result);
      this.logger.debug(`ReadDelivery result: ${resultStr}`);
      return JSON.parse(resultStr) as Delivery;
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        throw new NotFoundException(`Delivery ${deliveryId} not found`);
      }
      if (error.message?.includes('not authorized')) {
        throw new BadRequestException('Not authorized to view this delivery');
      }
      throw error;
    }
  }

  /**
   * Update delivery location (delivery person only)
   */
  async updateLocation(
    userId: string,
    deliveryId: string,
    dto: UpdateLocationDto,
  ): Promise<void> {
    await this.ensureIdentity(userId);

    try {
      await this.fabricGatewayService.submitTransaction(
        userId,
        'UpdateLocation',
        deliveryId,
        dto.city,
        dto.state,
        dto.country,
      );

      this.logger.log(`Updated location for delivery ${deliveryId}`);
    } catch (error: any) {
      this.logger.error(`Failed to update location: ${error.message}`);
      throw new BadRequestException(`Failed to update location: ${error.message}`);
    }
  }

  /**
   * Initiate a handoff to another user
   */
  async initiateHandoff(
    userId: string,
    deliveryId: string,
    dto: InitiateHandoffDto,
  ): Promise<void> {
    await this.ensureIdentity(userId);

    // Verify target user exists and has correct role
    const targetUser = await this.usersService.findById(dto.toUserId);
    if (!targetUser) {
      throw new BadRequestException('Target user not found');
    }
    if (targetUser.role !== dto.toRole) {
      throw new BadRequestException('Target user role mismatch');
    }

    try {
      await this.fabricGatewayService.submitTransaction(
        userId,
        'InitiateHandoff',
        deliveryId,
        dto.toUserId,
        dto.toRole,
      );

      this.logger.log(`Initiated handoff for delivery ${deliveryId} to ${dto.toUserId}`);
    } catch (error: any) {
      this.logger.error(`Failed to initiate handoff: ${error.message}`);
      throw new BadRequestException(`Failed to initiate handoff: ${error.message}`);
    }
  }

  /**
   * Confirm a pending handoff (delivery person or customer)
   */
  async confirmHandoff(
    userId: string,
    deliveryId: string,
    dto: ConfirmHandoffDto,
  ): Promise<void> {
    await this.ensureIdentity(userId);

    // Get current delivery to check if package info is needed
    const delivery = await this.getDelivery(userId, deliveryId);

    // Use existing package info if not provided
    const weight = dto.packageWeight ?? delivery.packageWeight;
    const length = dto.packageLength ?? delivery.packageDimensions.length;
    const width = dto.packageWidth ?? delivery.packageDimensions.width;
    const height = dto.packageHeight ?? delivery.packageDimensions.height;

    try {
      await this.fabricGatewayService.submitTransaction(
        userId,
        'ConfirmHandoff',
        deliveryId,
        dto.city,
        dto.state,
        dto.country,
        weight.toString(),
        length.toString(),
        width.toString(),
        height.toString(),
      );

      this.logger.log(`Confirmed handoff for delivery ${deliveryId}`);
    } catch (error: any) {
      this.logger.error(`Failed to confirm handoff: ${error.message}`);
      throw new BadRequestException(`Failed to confirm handoff: ${error.message}`);
    }
  }

  /**
   * Dispute a pending handoff
   */
  async disputeHandoff(
    userId: string,
    deliveryId: string,
    dto: DisputeHandoffDto,
  ): Promise<void> {
    await this.ensureIdentity(userId);

    try {
      await this.fabricGatewayService.submitTransaction(
        userId,
        'DisputeHandoff',
        deliveryId,
        dto.reason,
      );

      this.logger.log(`Disputed handoff for delivery ${deliveryId}`);
    } catch (error: any) {
      this.logger.error(`Failed to dispute handoff: ${error.message}`);
      throw new BadRequestException(`Failed to dispute handoff: ${error.message}`);
    }
  }

  /**
   * Cancel a pending handoff (initiator only)
   */
  async cancelHandoff(userId: string, deliveryId: string): Promise<void> {
    await this.ensureIdentity(userId);

    try {
      await this.fabricGatewayService.submitTransaction(
        userId,
        'CancelHandoff',
        deliveryId,
      );

      this.logger.log(`Cancelled handoff for delivery ${deliveryId}`);
    } catch (error: any) {
      this.logger.error(`Failed to cancel handoff: ${error.message}`);
      throw new BadRequestException(`Failed to cancel handoff: ${error.message}`);
    }
  }

  /**
   * Cancel a delivery (customer only, before pickup)
   */
  async cancelDelivery(userId: string, deliveryId: string): Promise<void> {
    await this.ensureIdentity(userId);

    try {
      await this.fabricGatewayService.submitTransaction(
        userId,
        'CancelDelivery',
        deliveryId,
      );

      this.logger.log(`Cancelled delivery ${deliveryId}`);
    } catch (error: any) {
      this.logger.error(`Failed to cancel delivery: ${error.message}`);
      throw new BadRequestException(`Failed to cancel delivery: ${error.message}`);
    }
  }

  /**
   * Query deliveries for the current user
   */
  async getMyDeliveries(userId: string): Promise<Delivery[]> {
    await this.ensureIdentity(userId);

    try {
      const result = await this.fabricGatewayService.evaluateTransaction(
        userId,
        'QueryDeliveriesByCustodian',
        userId,
      );

      return JSON.parse(new TextDecoder().decode(result)) as Delivery[];
    } catch (error: any) {
      this.logger.error(`Failed to query deliveries: ${error.message}`);
      return [];
    }
  }

  /**
   * Query deliveries by status
   */
  async getDeliveriesByStatus(userId: string, status: DeliveryStatus): Promise<Delivery[]> {
    await this.ensureIdentity(userId);

    try {
      const result = await this.fabricGatewayService.evaluateTransaction(
        userId,
        'QueryDeliveriesByStatus',
        status,
      );

      return JSON.parse(new TextDecoder().decode(result)) as Delivery[];
    } catch (error: any) {
      this.logger.error(`Failed to query deliveries by status: ${error.message}`);
      return [];
    }
  }

  /**
   * Get delivery history from blockchain
   */
  async getDeliveryHistory(userId: string, deliveryId: string): Promise<DeliveryHistoryRecord[]> {
    await this.ensureIdentity(userId);

    try {
      const result = await this.fabricGatewayService.evaluateTransaction(
        userId,
        'GetDeliveryHistory',
        deliveryId,
      );

      const resultStr = new TextDecoder().decode(result);
      this.logger.debug(`GetDeliveryHistory result: ${resultStr}`);
      return JSON.parse(resultStr) as DeliveryHistoryRecord[];
    } catch (error: any) {
      if (error.message?.includes('not authorized') || error.message?.includes('only seller')) {
        throw new BadRequestException('Not authorized to view delivery history');
      }
      this.logger.error(`Failed to get delivery history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get customer delivery address (for delivery persons)
   */
  async getDeliveryAddress(
    userId: string,
    userRole: UserRole,
    deliveryId: string,
  ): Promise<{ fullName: string; address: any } | null> {
    // Only delivery persons and admin can access this
    if (userRole !== UserRole.DELIVERY_PERSON && userRole !== UserRole.ADMIN) {
      throw new BadRequestException('Only delivery persons can access customer addresses');
    }

    // Get delivery to find customer ID
    const delivery = await this.getDelivery(userId, deliveryId);

    // Verify the delivery person is authorized:
    // - current custodian, OR
    // - target of any pending handoff (so they can see address before accepting)
    if (userRole === UserRole.DELIVERY_PERSON) {
      const isAuthorized =
        delivery.currentCustodianId === userId ||
        delivery.pendingHandoff?.toUserId === userId;

      if (!isAuthorized) {
        throw new BadRequestException('Not authorized to access this delivery address');
      }
    }

    return this.usersService.getDeliveryAddress(delivery.customerId);
  }
}
