import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, Network } from '@hyperledger/fabric-gateway';
import * as fs from 'fs';
import * as path from 'path';
import { WalletService } from './wallet.service';
import { createIdentity, createSigner, FabricIdentity } from './fabric.types';

interface OrgConnection {
  client: grpc.Client;
  tlsCert: Buffer;
  peerEndpoint: string;
  peerHostAlias: string;
}

@Injectable()
export class FabricGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FabricGatewayService.name);
  private orgConnections = new Map<string, OrgConnection>();
  private activeGateways = new Map<string, Gateway>();
  private channelName: string;
  private chaincodeName: string;

  constructor(
    private configService: ConfigService,
    private walletService: WalletService,
  ) {
    this.channelName = this.configService.get<string>('CHANNEL_NAME', 'deliverychannel');
    this.chaincodeName = this.configService.get<string>('CHAINCODE_NAME', 'delivery');
  }

  async onModuleInit() {
    await this.initializeConnections();
  }

  async onModuleDestroy() {
    // Close all active gateways
    for (const gateway of this.activeGateways.values()) {
      gateway.close();
    }
    this.activeGateways.clear();

    // Close all gRPC clients
    for (const conn of this.orgConnections.values()) {
      conn.client.close();
    }
    this.orgConnections.clear();
  }

  private async initializeConnections() {
    const cryptoPath = this.configService.get<string>(
      'FABRIC_CRYPTO_PATH',
      '/home/leviathan/Desktop/tracking/fabric-network/organizations',
    );

    const peerConfigs = [
      {
        org: 'PlatformOrg',
        peerEndpoint: this.configService.get<string>('PEER_PLATFORM_ENDPOINT', 'localhost:7051'),
        peerHostAlias: 'peer0.platform.example.com',
        tlsCertPath: path.join(cryptoPath, 'peerOrganizations/platform.example.com/peers/peer0.platform.example.com/tls/ca.crt'),
      },
      {
        org: 'SellersOrg',
        peerEndpoint: this.configService.get<string>('PEER_SELLERS_ENDPOINT', 'localhost:8051'),
        peerHostAlias: 'peer0.sellers.example.com',
        tlsCertPath: path.join(cryptoPath, 'peerOrganizations/sellers.example.com/peers/peer0.sellers.example.com/tls/ca.crt'),
      },
      {
        org: 'LogisticsOrg',
        peerEndpoint: this.configService.get<string>('PEER_LOGISTICS_ENDPOINT', 'localhost:9051'),
        peerHostAlias: 'peer0.logistics.example.com',
        tlsCertPath: path.join(cryptoPath, 'peerOrganizations/logistics.example.com/peers/peer0.logistics.example.com/tls/ca.crt'),
      },
    ];

    for (const config of peerConfigs) {
      try {
        if (!fs.existsSync(config.tlsCertPath)) {
          this.logger.warn(`TLS cert not found for ${config.org}, skipping peer connection`);
          continue;
        }

        const tlsCert = fs.readFileSync(config.tlsCertPath);
        const tlsCredentials = grpc.credentials.createSsl(tlsCert);

        const client = new grpc.Client(config.peerEndpoint, tlsCredentials, {
          'grpc.ssl_target_name_override': config.peerHostAlias,
        });

        this.orgConnections.set(config.org, {
          client,
          tlsCert,
          peerEndpoint: config.peerEndpoint,
          peerHostAlias: config.peerHostAlias,
        });

        this.logger.log(`Initialized gRPC connection to ${config.org} peer`);
      } catch (error) {
        this.logger.warn(`Failed to initialize connection for ${config.org}: ${error}`);
      }
    }
  }

  /**
   * Connect to the gateway using a user's identity
   */
  async connectWithIdentity(userId: string): Promise<Gateway> {
    // Check if we already have an active gateway for this user
    if (this.activeGateways.has(userId)) {
      return this.activeGateways.get(userId)!;
    }

    // Get identity from wallet
    const fabricIdentity = await this.walletService.get(userId);
    if (!fabricIdentity) {
      throw new Error(`Identity not found for user: ${userId}`);
    }

    return this.connectWithFabricIdentity(userId, fabricIdentity);
  }

  /**
   * Connect using a FabricIdentity object
   */
  async connectWithFabricIdentity(userId: string, fabricIdentity: FabricIdentity): Promise<Gateway> {
    // Determine which org connection to use based on MSP ID
    const org = this.mspIdToOrg(fabricIdentity.mspId);
    const connection = this.orgConnections.get(org);

    if (!connection) {
      throw new Error(`No connection available for organization: ${org}`);
    }

    const identity = createIdentity(fabricIdentity.mspId, fabricIdentity.certificate);
    const signer = createSigner(fabricIdentity.privateKey);

    const gateway = connect({
      client: connection.client,
      identity,
      signer,
      evaluateOptions: () => ({ deadline: Date.now() + 30000 }), // 30 seconds
      endorseOptions: () => ({ deadline: Date.now() + 60000 }), // 60 seconds
      submitOptions: () => ({ deadline: Date.now() + 60000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 120000 }), // 2 minutes
    });

    this.activeGateways.set(userId, gateway);
    return gateway;
  }

  /**
   * Get the delivery contract for a user
   */
  async getContract(userId: string): Promise<Contract> {
    const gateway = await this.connectWithIdentity(userId);
    const network = gateway.getNetwork(this.channelName);
    return network.getContract(this.chaincodeName);
  }

  /**
   * Submit a transaction (write operation)
   */
  async submitTransaction(
    userId: string,
    functionName: string,
    ...args: string[]
  ): Promise<Uint8Array> {
    const contract = await this.getContract(userId);

    this.logger.debug(`Submitting transaction: ${functionName}(${args.join(', ')}) as ${userId}`);

    const result = await contract.submitTransaction(functionName, ...args);

    this.logger.debug(`Transaction ${functionName} completed`);

    return result;
  }

  /**
   * Evaluate a transaction (read operation)
   */
  async evaluateTransaction(
    userId: string,
    functionName: string,
    ...args: string[]
  ): Promise<Uint8Array> {
    const contract = await this.getContract(userId);

    this.logger.debug(`Evaluating transaction: ${functionName}(${args.join(', ')}) as ${userId}`);

    return contract.evaluateTransaction(functionName, ...args);
  }

  /**
   * Disconnect a user's gateway
   */
  disconnectUser(userId: string): void {
    const gateway = this.activeGateways.get(userId);
    if (gateway) {
      gateway.close();
      this.activeGateways.delete(userId);
      this.logger.debug(`Disconnected gateway for user: ${userId}`);
    }
  }

  /**
   * Check if connections are ready
   */
  isReady(): boolean {
    return this.orgConnections.size > 0;
  }

  private mspIdToOrg(mspId: string): string {
    const mapping: Record<string, string> = {
      PlatformOrgMSP: 'PlatformOrg',
      SellersOrgMSP: 'SellersOrg',
      LogisticsOrgMSP: 'LogisticsOrg',
    };
    return mapping[mspId] || 'PlatformOrg';
  }
}
