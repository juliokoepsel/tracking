import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  role?: string;
}

/**
 * WebSocket Gateway for real-time delivery tracking events
 * 
 * Events emitted to clients:
 * - delivery:created - New delivery created
 * - delivery:statusChanged - Delivery status changed
 * - handoff:initiated - Handoff initiated
 * - handoff:confirmed - Handoff confirmed
 * - handoff:disputed - Handoff disputed
 * 
 * Events from clients:
 * - subscribe:delivery - Subscribe to updates for specific delivery
 * - unsubscribe:delivery - Unsubscribe from delivery updates
 * - subscribe:user - Subscribe to all updates for a user
 */
@WebSocketGateway({
  cors: {
    origin: '*', // In production, restrict this
    credentials: true,
  },
  namespace: '/delivery-events',
})
export class DeliveryEventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DeliveryEventsGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();
  private readonly deliverySubscriptions = new Map<string, Set<string>>(); // deliveryId -> Set of socketIds
  private readonly userSubscriptions = new Map<string, Set<string>>(); // userId -> Set of socketIds

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract JWT token from handshake
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (token) {
        try {
          const payload = this.jwtService.verify(token, {
            secret: this.configService.get<string>('JWT_SECRET'),
          });
          client.userId = payload.sub;
          client.role = payload.role;
          this.logger.log(`Client connected: ${client.id} (User: ${client.userId})`);
        } catch (error) {
          this.logger.warn(`Invalid token for client ${client.id}`);
        }
      }

      this.connectedClients.set(client.id, client);
      this.logger.log(`Client connected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Error handling connection: ${error}`);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);

    // Clean up subscriptions
    for (const [deliveryId, subscribers] of this.deliverySubscriptions.entries()) {
      subscribers.delete(client.id);
      if (subscribers.size === 0) {
        this.deliverySubscriptions.delete(deliveryId);
      }
    }

    for (const [userId, subscribers] of this.userSubscriptions.entries()) {
      subscribers.delete(client.id);
      if (subscribers.size === 0) {
        this.userSubscriptions.delete(userId);
      }
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Subscribe to updates for a specific delivery
   */
  @SubscribeMessage('subscribe:delivery')
  handleSubscribeDelivery(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { deliveryId: string },
  ) {
    const { deliveryId } = data;

    if (!deliveryId) {
      return { success: false, error: 'deliveryId is required' };
    }

    // Add client to delivery room
    client.join(`delivery:${deliveryId}`);

    // Track subscription
    if (!this.deliverySubscriptions.has(deliveryId)) {
      this.deliverySubscriptions.set(deliveryId, new Set());
    }
    this.deliverySubscriptions.get(deliveryId)!.add(client.id);

    this.logger.debug(`Client ${client.id} subscribed to delivery ${deliveryId}`);

    return { success: true, message: `Subscribed to delivery ${deliveryId}` };
  }

  /**
   * Unsubscribe from delivery updates
   */
  @SubscribeMessage('unsubscribe:delivery')
  handleUnsubscribeDelivery(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { deliveryId: string },
  ) {
    const { deliveryId } = data;

    if (!deliveryId) {
      return { success: false, error: 'deliveryId is required' };
    }

    client.leave(`delivery:${deliveryId}`);

    const subscribers = this.deliverySubscriptions.get(deliveryId);
    if (subscribers) {
      subscribers.delete(client.id);
      if (subscribers.size === 0) {
        this.deliverySubscriptions.delete(deliveryId);
      }
    }

    this.logger.debug(`Client ${client.id} unsubscribed from delivery ${deliveryId}`);

    return { success: true, message: `Unsubscribed from delivery ${deliveryId}` };
  }

  /**
   * Subscribe to all updates for a specific user
   */
  @SubscribeMessage('subscribe:user')
  handleSubscribeUser(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId: string },
  ) {
    const { userId } = data;

    // Users can only subscribe to their own events (unless admin)
    if (client.userId && client.role !== 'ADMIN' && client.userId !== userId) {
      return { success: false, error: 'Unauthorized to subscribe to this user' };
    }

    client.join(`user:${userId}`);

    if (!this.userSubscriptions.has(userId)) {
      this.userSubscriptions.set(userId, new Set());
    }
    this.userSubscriptions.get(userId)!.add(client.id);

    this.logger.debug(`Client ${client.id} subscribed to user ${userId}`);

    return { success: true, message: `Subscribed to user ${userId}` };
  }

  // =====================================================
  // Chaincode Event Handlers
  // =====================================================

  @OnEvent('chaincode.delivery.created')
  handleDeliveryCreated(event: {
    type: string;
    payload: { deliveryId: string; orderId: string; newStatus: string; timestamp: string };
    transactionId: string;
    blockNumber: bigint;
  }) {
    const { deliveryId } = event.payload;

    // Emit to delivery room
    this.server.to(`delivery:${deliveryId}`).emit('delivery:created', {
      ...event.payload,
      transactionId: event.transactionId,
      blockNumber: event.blockNumber.toString(),
    });

    this.logger.log(`Emitted delivery:created for ${deliveryId}`);
  }

  @OnEvent('chaincode.delivery.statusChanged')
  handleDeliveryStatusChanged(event: {
    type: string;
    payload: {
      deliveryId: string;
      orderId: string;
      oldStatus: string;
      newStatus: string;
      timestamp: string;
    };
    transactionId: string;
    blockNumber: bigint;
  }) {
    const { deliveryId } = event.payload;

    // Emit to delivery room
    this.server.to(`delivery:${deliveryId}`).emit('delivery:statusChanged', {
      ...event.payload,
      transactionId: event.transactionId,
      blockNumber: event.blockNumber.toString(),
    });

    this.logger.log(`Emitted delivery:statusChanged for ${deliveryId}`);
  }

  @OnEvent('chaincode.handoff.initiated')
  handleHandoffInitiated(event: {
    type: string;
    payload: {
      deliveryId: string;
      orderId: string;
      fromUserId: string;
      toUserId: string;
      timestamp: string;
    };
    transactionId: string;
    blockNumber: bigint;
  }) {
    const { deliveryId, fromUserId, toUserId } = event.payload;

    const eventData = {
      ...event.payload,
      transactionId: event.transactionId,
      blockNumber: event.blockNumber.toString(),
    };

    // Emit to delivery room
    this.server.to(`delivery:${deliveryId}`).emit('handoff:initiated', eventData);

    // Emit to involved users
    this.server.to(`user:${fromUserId}`).emit('handoff:initiated', eventData);
    this.server.to(`user:${toUserId}`).emit('handoff:initiated', eventData);

    this.logger.log(`Emitted handoff:initiated for ${deliveryId}`);
  }

  @OnEvent('chaincode.handoff.confirmed')
  handleHandoffConfirmed(event: {
    type: string;
    payload: {
      deliveryId: string;
      orderId: string;
      newCustodianId: string;
      timestamp: string;
    };
    transactionId: string;
    blockNumber: bigint;
  }) {
    const { deliveryId, newCustodianId } = event.payload;

    const eventData = {
      ...event.payload,
      transactionId: event.transactionId,
      blockNumber: event.blockNumber.toString(),
    };

    // Emit to delivery room
    this.server.to(`delivery:${deliveryId}`).emit('handoff:confirmed', eventData);

    // Emit to new custodian
    this.server.to(`user:${newCustodianId}`).emit('handoff:confirmed', eventData);

    this.logger.log(`Emitted handoff:confirmed for ${deliveryId}`);
  }

  @OnEvent('chaincode.handoff.disputed')
  handleHandoffDisputed(event: {
    type: string;
    payload: {
      deliveryId: string;
      orderId: string;
      disputedBy: string;
      timestamp: string;
    };
    transactionId: string;
    blockNumber: bigint;
  }) {
    const { deliveryId, disputedBy } = event.payload;

    const eventData = {
      ...event.payload,
      transactionId: event.transactionId,
      blockNumber: event.blockNumber.toString(),
    };

    // Emit to delivery room
    this.server.to(`delivery:${deliveryId}`).emit('handoff:disputed', eventData);

    // Emit to disputing user
    this.server.to(`user:${disputedBy}`).emit('handoff:disputed', eventData);

    this.logger.log(`Emitted handoff:disputed for ${deliveryId}`);
  }

  /**
   * Get current connection stats
   */
  getStats() {
    return {
      connectedClients: this.connectedClients.size,
      deliverySubscriptions: this.deliverySubscriptions.size,
      userSubscriptions: this.userSubscriptions.size,
    };
  }
}
