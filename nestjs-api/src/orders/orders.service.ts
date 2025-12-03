import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Order, OrderDocument } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { ShopItemsService } from '../shop-items/shop-items.service';
import { DeliveriesService } from '../deliveries/deliveries.service';
import { UsersService } from '../users/users.service';
import { CrossOrgVerificationService } from '../auth/cross-org-verification.service';
import { OrderStatus, UserRole } from '../common/enums';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private shopItemsService: ShopItemsService,
    private usersService: UsersService,
    @Inject(forwardRef(() => DeliveriesService))
    private deliveriesService: DeliveriesService,
    private crossOrgVerificationService: CrossOrgVerificationService,
  ) {}

  /**
   * Create a new order (customer only)
   * In multi-org architecture, orders are created on the Sellers API
   * where shop items exist. Customers from Platform API authenticate via JWT
   * and are verified via cross-org HTTP call to Platform API.
   */
  async create(
    customerId: string,
    createDto: CreateOrderDto,
    isLocalUser: boolean = true,
  ): Promise<OrderDocument> {
    // Cross-org verification for customers from Platform API
    // This is a SENSITIVE WRITE operation, so we verify the customer actually exists
    if (!isLocalUser) {
      const verifiedUser = await this.crossOrgVerificationService.verifyUser(
        customerId,
        UserRole.CUSTOMER,
      );
      
      if (!verifiedUser) {
        throw new UnauthorizedException('Failed to verify customer identity');
      }
      
      if (!verifiedUser.isActive) {
        throw new UnauthorizedException('Customer account is deactivated');
      }
      
      this.logger.log(`Cross-org verified customer ${customerId} for order creation`);
    }

    // Validate and fetch items with current prices
    let totalInCents = 0;
    const orderItems = [];

    for (const itemDto of createDto.items) {
      const item = await this.shopItemsService.findById(itemDto.itemId);

      if (!item) {
        throw new BadRequestException(`Item not found: ${itemDto.itemId}`);
      }

      if (!item.isActive) {
        throw new BadRequestException(`Item is not available: ${item.name}`);
      }

      if (item.sellerId !== createDto.sellerId) {
        throw new BadRequestException(`Item ${item.name} does not belong to the specified seller`);
      }

      // Use current price from database (not client-provided)
      const itemTotal = item.priceInCents * itemDto.quantity;
      totalInCents += itemTotal;

      orderItems.push({
        itemId: item._id.toString(),
        quantity: itemDto.quantity,
        priceAtPurchase: item.priceInCents,
      });
    }

    const order = new this.orderModel({
      sellerId: createDto.sellerId,
      customerId,
      items: orderItems,
      totalInCents,
      status: OrderStatus.PENDING,
    });

    await order.save();

    this.logger.log(`Created order ${order._id} for customer ${customerId}`);

    return order;
  }

  /**
   * Confirm an order and create blockchain delivery (seller only)
   */
  async confirm(
    orderId: string,
    sellerId: string,
    confirmDto: ConfirmOrderDto,
  ): Promise<{ order: OrderDocument; deliveryId: string }> {
    const order = await this.orderModel.findById(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.sellerId !== sellerId) {
      throw new ForbiddenException('You can only confirm your own orders');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not pending');
    }

    // Create delivery on blockchain
    // The sellerId is extracted from the X.509 certificate in the chaincode
    const deliveryId = await this.deliveriesService.createDelivery(
      sellerId,
      order._id.toString(),
      order.customerId,
      confirmDto.packageWeight,
      confirmDto.packageLength,
      confirmDto.packageWidth,
      confirmDto.packageHeight,
      confirmDto.city,
      confirmDto.state,
      confirmDto.country,
    );

    // Update order status
    order.status = OrderStatus.CONFIRMED;
    order.deliveryId = deliveryId;
    await order.save();

    this.logger.log(`Confirmed order ${orderId}, delivery: ${deliveryId}`);

    return { order, deliveryId };
  }

  /**
   * Cancel an order (customer only, before confirmation)
   */
  async cancel(orderId: string, customerId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('You can only cancel your own orders');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Can only cancel pending orders');
    }

    order.status = OrderStatus.CANCELLED;
    await order.save();

    this.logger.log(`Cancelled order ${orderId}`);

    return order;
  }

  /**
   * Find orders with role-based filtering
   */
  async findAll(
    userId: string,
    userRole: UserRole,
    status?: OrderStatus,
  ): Promise<OrderDocument[]> {
    const query: any = {};

    // Role-based filtering
    if (userRole === UserRole.CUSTOMER) {
      query.customerId = userId;
    } else if (userRole === UserRole.SELLER) {
      query.sellerId = userId;
    }
    // Admin sees all

    if (status) {
      query.status = status;
    }

    return this.orderModel.find(query).sort({ createdAt: -1 }).exec();
  }

  /**
   * Find order by ID with authorization check
   */
  async findById(
    orderId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<OrderDocument | null> {
    const order = await this.orderModel.findById(orderId);

    if (!order) {
      return null;
    }

    // Authorization check
    if (userRole !== UserRole.ADMIN) {
      if (
        (userRole === UserRole.CUSTOMER && order.customerId !== userId) ||
        (userRole === UserRole.SELLER && order.sellerId !== userId)
      ) {
        throw new ForbiddenException('Not authorized to view this order');
      }
    }

    return order;
  }

  /**
   * Get order by delivery ID
   */
  async findByDeliveryId(deliveryId: string): Promise<OrderDocument | null> {
    return this.orderModel.findOne({ deliveryId }).exec();
  }
}
