import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FabricCAServices = require('fabric-ca-client');
import { User } from 'fabric-common';
import * as fs from 'fs';
import * as path from 'path';
import { UserRole, RoleToCAMap, RoleToMSPMap, RoleToOrgMap, FabricOrg, FabricMSP, OrgAllowedRoles } from '../common/enums';
import { EnrollmentResult } from './fabric.types';

interface CAConnection {
  caClient: typeof FabricCAServices;
  caName: string;
  mspId: string;
  organization: string;
}

@Injectable()
export class FabricCAService implements OnModuleInit {
  private readonly logger = new Logger(FabricCAService.name);
  private caConnections = new Map<string, CAConnection>();
  private adminIdentities = new Map<string, { certificate: string; privateKey: string }>();
  private currentOrg: string | null; // The org this API instance serves

  constructor(private configService: ConfigService) {
    // ORG_NAME determines which org this API instance serves
    this.currentOrg = this.configService.get<string>('ORG_NAME') || null;
  }

  async onModuleInit() {
    await this.initializeCAConnections();
  }

  /**
   * Get the organization this API instance serves
   */
  getCurrentOrg(): string | null {
    return this.currentOrg;
  }

  /**
   * Check if a role is allowed for this API instance's organization
   */
  isRoleAllowedForOrg(role: UserRole): boolean {
    if (!this.currentOrg) {
      return true; // Single-API mode allows all roles
    }
    const allowedRoles = OrgAllowedRoles[this.currentOrg] || [];
    return allowedRoles.includes(role);
  }

  private async initializeCAConnections() {
    const cryptoPath = this.configService.get<string>(
      'FABRIC_CRYPTO_PATH',
      '/home/leviathan/Desktop/tracking/fabric-network/organizations',
    );

    // Build CA URLs from host and port
    const platformHost = this.configService.get<string>('CA_PLATFORM_HOST', 'localhost');
    const platformPort = this.configService.get<string>('CA_PLATFORM_PORT', '7054');
    const sellersHost = this.configService.get<string>('CA_SELLERS_HOST', 'localhost');
    const sellersPort = this.configService.get<string>('CA_SELLERS_PORT', '8054');
    const logisticsHost = this.configService.get<string>('CA_LOGISTICS_HOST', 'localhost');
    const logisticsPort = this.configService.get<string>('CA_LOGISTICS_PORT', '9054');

    const caConfigs = [
      {
        org: FabricOrg.PLATFORM,
        mspId: FabricMSP.PLATFORM,
        caName: 'ca-platform',
        caUrl: `https://${platformHost}:${platformPort}`,
        tlsCertPath: path.join(cryptoPath, 'peerOrganizations/platform.example.com/tlsca/tlsca.platform.example.com-cert.pem'),
        adminMspPath: path.join(cryptoPath, 'peerOrganizations/platform.example.com/users/Admin@platform.example.com/msp'),
      },
      {
        org: FabricOrg.SELLERS,
        mspId: FabricMSP.SELLERS,
        caName: 'ca-sellers',
        caUrl: `https://${sellersHost}:${sellersPort}`,
        tlsCertPath: path.join(cryptoPath, 'peerOrganizations/sellers.example.com/tlsca/tlsca.sellers.example.com-cert.pem'),
        adminMspPath: path.join(cryptoPath, 'peerOrganizations/sellers.example.com/users/Admin@sellers.example.com/msp'),
      },
      {
        org: FabricOrg.LOGISTICS,
        mspId: FabricMSP.LOGISTICS,
        caName: 'ca-logistics',
        caUrl: `https://${logisticsHost}:${logisticsPort}`,
        tlsCertPath: path.join(cryptoPath, 'peerOrganizations/logistics.example.com/tlsca/tlsca.logistics.example.com-cert.pem'),
        adminMspPath: path.join(cryptoPath, 'peerOrganizations/logistics.example.com/users/Admin@logistics.example.com/msp'),
      },
    ];

    // Filter to only the configured org if ORG_NAME is set (decentralized mode)
    const configsToInit = this.currentOrg
      ? caConfigs.filter(c => c.org === this.currentOrg)
      : caConfigs;

    if (this.currentOrg) {
      this.logger.log(`Decentralized mode: initializing only ${this.currentOrg} CA connection`);
    } else {
      this.logger.log(`Single-API mode: initializing all CA connections`);
    }

    for (const config of configsToInit) {
      try {
        // Check if TLS cert exists (network might not be set up yet)
        if (!fs.existsSync(config.tlsCertPath)) {
          this.logger.warn(`TLS cert not found for ${config.org}, skipping CA initialization`);
          continue;
        }

        const tlsCert = fs.readFileSync(config.tlsCertPath, 'utf8');

        const caClient = new FabricCAServices(config.caUrl, {
          trustedRoots: [tlsCert],
          verify: false, // Set to true in production with proper certs
        }, config.caName);

        this.caConnections.set(config.org, {
          caClient,
          caName: config.caName,
          mspId: config.mspId,
          organization: config.org,
        });

        // Enroll the bootstrap admin with the CA
        await this.enrollBootstrapAdmin(config.org, caClient, config.mspId);

        this.logger.log(`Initialized CA connection for ${config.org}`);
      } catch (error) {
        this.logger.warn(`Failed to initialize CA for ${config.org}: ${error}`);
      }
    }
  }

  /**
   * Enroll the bootstrap admin identity from Fabric CA
   */
  private async enrollBootstrapAdmin(org: string, caClient: any, mspId: string) {
    try {
      // Bootstrap admin credentials (set during CA initialization)
      const adminId = 'admin';
      const adminSecret = 'adminpw';

      const enrollment = await caClient.enroll({
        enrollmentID: adminId,
        enrollmentSecret: adminSecret,
      });

      this.adminIdentities.set(org, {
        certificate: enrollment.certificate,
        privateKey: enrollment.key.toBytes(),
      });

      this.logger.log(`Enrolled bootstrap admin for ${org}`);
    } catch (error: any) {
      this.logger.warn(`Failed to enroll bootstrap admin for ${org}: ${error.message}`);
      // Fall back to loading from MSP directory if available
    }
  }

  private async loadAdminIdentityFromMsp(org: string, mspPath: string) {
    try {
      const certPath = path.join(mspPath, 'signcerts');
      const keyPath = path.join(mspPath, 'keystore');

      if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
        this.logger.warn(`Admin MSP not found for ${org}`);
        return;
      }

      const certFiles = fs.readdirSync(certPath);
      const keyFiles = fs.readdirSync(keyPath);

      if (certFiles.length === 0 || keyFiles.length === 0) {
        this.logger.warn(`Admin cert/key files not found for ${org}`);
        return;
      }

      const certificate = fs.readFileSync(path.join(certPath, certFiles[0]), 'utf8');
      const privateKey = fs.readFileSync(path.join(keyPath, keyFiles[0]), 'utf8');

      this.adminIdentities.set(org, { certificate, privateKey });
      this.logger.log(`Loaded admin identity for ${org}`);
    } catch (error) {
      this.logger.warn(`Failed to load admin identity for ${org}: ${error}`);
    }
  }

  /**
   * Enroll a new user with the appropriate Fabric CA
   * 
   * @param userId - Unique identifier for the user
   * @param role - User's role (determines which org's CA to use)
   * @param options - Optional enrollment options
   * @param options.secret - Pre-defined enrollment secret
   * @param options.companyId - Company identifier for multi-tenant affiliation
   * @param options.companyName - Human-readable company name
   */
  async enrollUser(
    userId: string,
    role: UserRole,
    options?: {
      secret?: string;
      companyId?: string;
      companyName?: string;
    },
  ): Promise<EnrollmentResult> {
    const org = RoleToOrgMap[role];
    const mspId = RoleToMSPMap[role];
    const connection = this.caConnections.get(org);

    if (!connection) {
      throw new Error(`CA connection not available for organization: ${org}`);
    }

    const adminIdentity = this.adminIdentities.get(org);
    if (!adminIdentity) {
      throw new Error(`Admin identity not available for organization: ${org}`);
    }

    try {
      // First, register the user with the CA
      const enrollmentSecret = options?.secret || this.generateSecret();

      // Create a proper User object for the registrar
      // User.createUser(name, password, mspid, signedCertPEM, privateKeyPEM)
      const registrar = User.createUser(
        `admin-${org}`,
        '',  // password not needed for signing
        mspId,
        adminIdentity.certificate,
        adminIdentity.privateKey,
      );

      // Build attributes to embed in certificate
      // These attributes will be available to chaincode via GetAttributeValue()
      const attrs = [
        { name: 'role', value: role, ecert: true },
        { name: 'userId', value: userId, ecert: true },
      ];

      // Add company affiliation attributes if provided
      // This enables multi-tenant support within the same org
      if (options?.companyId) {
        attrs.push({ name: 'companyId', value: options.companyId, ecert: true });
      }
      if (options?.companyName) {
        attrs.push({ name: 'companyName', value: options.companyName, ecert: true });
      }

      // Determine affiliation string
      // Format: org.department or org.company.department
      // For sellers with companies: sellers.companyId
      // For independents: org (just the org name)
      let affiliation = '';
      if (options?.companyId && (role === UserRole.SELLER || role === UserRole.DELIVERY_PERSON)) {
        affiliation = `${org.toLowerCase()}.${options.companyId}`;
      }

      // Register the user (requires admin as User object)
      await connection.caClient.register(
        {
          enrollmentID: userId,
          enrollmentSecret,
          role: 'client',
          affiliation,
          attrs,
        },
        registrar,
      );

      this.logger.log(`Registered user ${userId} with CA ${connection.caName}${options?.companyId ? ` (company: ${options.companyId})` : ''}`);

      // Now enroll the user
      const enrollment = await connection.caClient.enroll({
        enrollmentID: userId,
        enrollmentSecret,
        attr_reqs: attrs.map(a => ({ name: a.name, optional: false })),
      });

      this.logger.log(`Enrolled user ${userId} with ${org}`);

      return {
        certificate: enrollment.certificate,
        privateKey: enrollment.key.toBytes(),
      };
    } catch (error: any) {
      // If user is already registered, try to re-enroll
      if (error.message?.includes('already registered')) {
        this.logger.warn(`User ${userId} already registered, attempting re-enrollment`);

        // For re-enrollment, we'd need the original secret
        // In production, you'd have a proper recovery flow
        throw new Error(`User ${userId} already exists in Fabric CA`);
      }

      // Log detailed error information
      this.logger.error(`Failed to enroll user ${userId}: ${error.message}`);
      if (error.errors) {
        this.logger.error(`Detailed errors: ${JSON.stringify(error.errors)}`);
      }
      if (error.cause) {
        this.logger.error(`Error cause: ${error.cause}`);
      }
      throw error;
    }
  }

  /**
   * Revoke a user's certificate
   */
  async revokeUser(userId: string, role: UserRole): Promise<void> {
    const org = RoleToOrgMap[role];
    const mspId = RoleToMSPMap[role];
    const connection = this.caConnections.get(org);

    if (!connection) {
      throw new Error(`CA connection not available for organization: ${org}`);
    }

    const adminIdentity = this.adminIdentities.get(org);
    if (!adminIdentity) {
      throw new Error(`Admin identity not available for organization: ${org}`);
    }

    try {
      await connection.caClient.revoke(
        { enrollmentID: userId },
        {
          certificate: adminIdentity.certificate,
          privateKey: adminIdentity.privateKey,
          mspId,
        } as any,
      );

      this.logger.log(`Revoked certificate for user ${userId}`);
    } catch (error: any) {
      this.logger.error(`Failed to revoke user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get admin identity for an organization
   */
  getAdminIdentity(org: string): { certificate: string; privateKey: string } | undefined {
    return this.adminIdentities.get(org);
  }

  /**
   * Check if CA connections are ready
   */
  isReady(): boolean {
    return this.caConnections.size > 0;
  }

  private generateSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
