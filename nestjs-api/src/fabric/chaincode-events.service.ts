import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as grpc from '@grpc/grpc-js';
import { connect, Gateway, Network, CloseableAsyncIterable, ChaincodeEvent } from '@hyperledger/fabric-gateway';
import * as fs from 'fs';
import * as path from 'path';
import { WalletService } from './wallet.service';
import { createIdentity, createSigner } from './fabric.types';

// Event types emitted by the chaincode
export interface DeliveryCreatedEvent {
  deliveryId: string;
  orderId: string;
  newStatus: string;
  timestamp: string;
}

export interface DeliveryStatusChangedEvent {
  deliveryId: string;
  orderId: string;
  oldStatus: string;
  newStatus: string;
  timestamp: string;
}

export interface HandoffInitiatedEvent {
  deliveryId: string;
  orderId: string;
  fromUserId: string;
  toUserId: string;
  timestamp: string;
}

export interface HandoffConfirmedEvent {
  deliveryId: string;
  orderId: string;
  newCustodianId: string;
  timestamp: string;
}

export interface HandoffDisputedEvent {
  deliveryId: string;
  orderId: string;
  disputedBy: string;
  timestamp: string;
}

// Union type for all chaincode events
export type ChaincodeEventPayload =
  | { type: 'DeliveryCreated'; payload: DeliveryCreatedEvent }
  | { type: 'DeliveryStatusChanged'; payload: DeliveryStatusChangedEvent }
  | { type: 'HandoffInitiated'; payload: HandoffInitiatedEvent }
  | { type: 'HandoffConfirmed'; payload: HandoffConfirmedEvent }
  | { type: 'HandoffDisputed'; payload: HandoffDisputedEvent };

@Injectable()
export class ChaincodeEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChaincodeEventsService.name);
  private gateway: Gateway | null = null;
  private network: Network | null = null;
  private eventIterator: CloseableAsyncIterable<ChaincodeEvent> | null = null;
  private isListening = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000; // 5 seconds

  constructor(
    private configService: ConfigService,
    private walletService: WalletService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    // Delay startup to allow the network to be ready
    setTimeout(() => this.startEventListener(), 10000);
  }

  async onModuleDestroy() {
    await this.stopEventListener();
  }

  /**
   * Start listening to chaincode events
   */
  async startEventListener(): Promise<void> {
    if (this.isListening) {
      this.logger.warn('Event listener already running');
      return;
    }

    try {
      await this.connect();
      this.isListening = true;
      this.reconnectAttempts = 0;
      this.logger.log('Chaincode event listener started');
      
      // Start processing events
      this.processEvents();
    } catch (error) {
      this.logger.error(`Failed to start event listener: ${error}`);
      this.scheduleReconnect();
    }
  }

  /**
   * Stop listening to chaincode events
   */
  async stopEventListener(): Promise<void> {
    this.isListening = false;

    if (this.eventIterator) {
      this.eventIterator.close();
      this.eventIterator = null;
    }

    if (this.gateway) {
      this.gateway.close();
      this.gateway = null;
    }

    this.network = null;
    this.logger.log('Chaincode event listener stopped');
  }

  /**
   * Connect to the Fabric network for event listening
   */
  private async connect(): Promise<void> {
    const cryptoPath = this.configService.get<string>(
      'FABRIC_CRYPTO_PATH',
      '/home/leviathan/Desktop/tracking/fabric-network/organizations',
    );

    // Use admin identity for event listening
    const adminUserId = 'admin';
    const adminIdentity = await this.walletService.get(adminUserId);

    if (!adminIdentity) {
      // If no admin in wallet, use the MSP credentials directly
      this.logger.warn('Admin identity not found in wallet, using MSP credentials');
      await this.connectWithMspCredentials(cryptoPath);
      return;
    }

    // Connect using admin identity from wallet
    const peerEndpoint = this.configService.get<string>('PEER_PLATFORM_ENDPOINT', 'localhost:7051');
    const tlsCertPath = path.join(
      cryptoPath,
      'peerOrganizations/platform.example.com/peers/peer0.platform.example.com/tls/ca.crt',
    );

    if (!fs.existsSync(tlsCertPath)) {
      throw new Error(`TLS certificate not found at ${tlsCertPath}`);
    }

    const tlsCert = fs.readFileSync(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsCert);

    const client = new grpc.Client(peerEndpoint, tlsCredentials, {
      'grpc.ssl_target_name_override': 'peer0.platform.example.com',
    });

    const identity = createIdentity(adminIdentity.mspId, adminIdentity.certificate);
    const signer = createSigner(adminIdentity.privateKey);

    this.gateway = connect({
      client,
      identity,
      signer,
      evaluateOptions: () => ({ deadline: Date.now() + 30000 }),
      endorseOptions: () => ({ deadline: Date.now() + 60000 }),
      submitOptions: () => ({ deadline: Date.now() + 60000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 120000 }),
    });

    const channelName = this.configService.get<string>('CHANNEL_NAME', 'deliverychannel');
    this.network = this.gateway.getNetwork(channelName);

    // Get chaincode events
    const chaincodeName = this.configService.get<string>('CHAINCODE_NAME', 'delivery');
    this.eventIterator = await this.network.getChaincodeEvents(chaincodeName);
  }

  /**
   * Connect using MSP credentials from filesystem (fallback)
   */
  private async connectWithMspCredentials(cryptoPath: string): Promise<void> {
    const peerEndpoint = this.configService.get<string>('PEER_PLATFORM_ENDPOINT', 'localhost:7051');
    
    const tlsCertPath = path.join(
      cryptoPath,
      'peerOrganizations/platform.example.com/peers/peer0.platform.example.com/tls/ca.crt',
    );
    const certPath = path.join(
      cryptoPath,
      'peerOrganizations/platform.example.com/users/Admin@platform.example.com/msp/signcerts/cert.pem',
    );
    const keyPath = path.join(
      cryptoPath,
      'peerOrganizations/platform.example.com/users/Admin@platform.example.com/msp/keystore',
    );

    if (!fs.existsSync(tlsCertPath) || !fs.existsSync(certPath)) {
      throw new Error('Required MSP credentials not found');
    }

    // Find the private key file in keystore
    const keyFiles = fs.readdirSync(keyPath);
    if (keyFiles.length === 0) {
      throw new Error('No private key found in keystore');
    }
    const privateKeyPath = path.join(keyPath, keyFiles[0]);

    const tlsCert = fs.readFileSync(tlsCertPath);
    const certificate = fs.readFileSync(certPath, 'utf-8');
    const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');

    const tlsCredentials = grpc.credentials.createSsl(tlsCert);
    const client = new grpc.Client(peerEndpoint, tlsCredentials, {
      'grpc.ssl_target_name_override': 'peer0.platform.example.com',
    });

    const identity = createIdentity('PlatformOrgMSP', certificate);
    const signer = createSigner(privateKey);

    this.gateway = connect({
      client,
      identity,
      signer,
      evaluateOptions: () => ({ deadline: Date.now() + 30000 }),
      endorseOptions: () => ({ deadline: Date.now() + 60000 }),
      submitOptions: () => ({ deadline: Date.now() + 60000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 120000 }),
    });

    const channelName = this.configService.get<string>('CHANNEL_NAME', 'deliverychannel');
    this.network = this.gateway.getNetwork(channelName);

    const chaincodeName = this.configService.get<string>('CHAINCODE_NAME', 'delivery');
    this.eventIterator = await this.network.getChaincodeEvents(chaincodeName);
  }

  /**
   * Process chaincode events
   */
  private async processEvents(): Promise<void> {
    if (!this.eventIterator) {
      this.logger.error('Event iterator not initialized');
      return;
    }

    try {
      for await (const event of this.eventIterator) {
        if (!this.isListening) {
          break;
        }

        this.handleEvent(event);
      }
    } catch (error) {
      if (this.isListening) {
        this.logger.error(`Event processing error: ${error}`);
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Handle a single chaincode event
   */
  private handleEvent(event: ChaincodeEvent): void {
    try {
      const eventName = event.eventName;
      const payload = event.payload ? JSON.parse(new TextDecoder().decode(event.payload)) : {};

      this.logger.log(`Received chaincode event: ${eventName}`);
      this.logger.debug(`Event payload: ${JSON.stringify(payload)}`);

      // Emit the event through NestJS EventEmitter2
      switch (eventName) {
        case 'DeliveryCreated':
          this.eventEmitter.emit('chaincode.delivery.created', {
            type: 'DeliveryCreated',
            payload: payload as DeliveryCreatedEvent,
            transactionId: event.transactionId,
            blockNumber: event.blockNumber,
          });
          break;

        case 'DeliveryStatusChanged':
          this.eventEmitter.emit('chaincode.delivery.statusChanged', {
            type: 'DeliveryStatusChanged',
            payload: payload as DeliveryStatusChangedEvent,
            transactionId: event.transactionId,
            blockNumber: event.blockNumber,
          });
          break;

        case 'HandoffInitiated':
          this.eventEmitter.emit('chaincode.handoff.initiated', {
            type: 'HandoffInitiated',
            payload: payload as HandoffInitiatedEvent,
            transactionId: event.transactionId,
            blockNumber: event.blockNumber,
          });
          break;

        case 'HandoffConfirmed':
          this.eventEmitter.emit('chaincode.handoff.confirmed', {
            type: 'HandoffConfirmed',
            payload: payload as HandoffConfirmedEvent,
            transactionId: event.transactionId,
            blockNumber: event.blockNumber,
          });
          break;

        case 'HandoffDisputed':
          this.eventEmitter.emit('chaincode.handoff.disputed', {
            type: 'HandoffDisputedEvent',
            payload: payload as HandoffDisputedEvent,
            transactionId: event.transactionId,
            blockNumber: event.blockNumber,
          });
          break;

        default:
          this.logger.warn(`Unknown chaincode event: ${eventName}`);
          this.eventEmitter.emit('chaincode.unknown', {
            eventName,
            payload,
            transactionId: event.transactionId,
            blockNumber: event.blockNumber,
          });
      }

      // Also emit a generic event for any listeners that want all events
      this.eventEmitter.emit('chaincode.event', {
        eventName,
        payload,
        transactionId: event.transactionId,
        blockNumber: event.blockNumber,
      });
    } catch (error) {
      this.logger.error(`Failed to handle event: ${error}`);
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    this.logger.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    setTimeout(async () => {
      await this.stopEventListener();
      await this.startEventListener();
    }, delay);
  }

  /**
   * Check if the event listener is running
   */
  isRunning(): boolean {
    return this.isListening;
  }
}
