import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { UserRole } from '../common/enums';

/**
 * Maps user roles to their home organization's API URL.
 * Used for cross-org verification of user identity.
 * Note: Internal Docker network uses HTTPS with self-signed certs.
 */
const RoleToApiUrl: Record<UserRole, string> = {
  [UserRole.CUSTOMER]: 'https://api-platform:3000/api/v1',
  [UserRole.SELLER]: 'https://api-sellers:3000/api/v1',
  [UserRole.DELIVERY_PERSON]: 'https://api-logistics:3000/api/v1',
  [UserRole.ADMIN]: 'https://api-platform:3000/api/v1',
};

export interface VerifiedUser {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
}

/**
 * Service for verifying users across different organization APIs.
 * 
 * In a multi-org architecture, users are stored in their organization's database:
 * - Customers → Platform API / MongoDB
 * - Sellers → Sellers API / MongoDB
 * - Logistics → Logistics API / MongoDB
 * 
 * When a user from one org makes a request to another org's API
 * (e.g., customer creating order on Sellers API), we need to verify
 * they actually exist and are active in their home org.
 * 
 * This is more secure than just trusting the JWT payload because:
 * 1. It checks real-time user status (deactivated users are rejected)
 * 2. It confirms the user actually exists (not just a valid JWT signature)
 */
@Injectable()
export class CrossOrgVerificationService {
  private readonly logger = new Logger(CrossOrgVerificationService.name);
  private readonly internalApiKey: string;

  constructor(private configService: ConfigService) {
    this.internalApiKey = this.configService.get<string>('INTERNAL_API_KEY', '');
  }

  /**
   * Verify a user exists and is active in their home organization's API.
   * 
   * @param userId - The user's ID (from JWT payload)
   * @param role - The user's role (from JWT payload)
   * @returns The verified user data, or null if verification fails
   */
  async verifyUser(userId: string, role: UserRole): Promise<VerifiedUser | null> {
    const apiUrl = RoleToApiUrl[role];
    
    if (!apiUrl) {
      this.logger.warn(`Unknown role for cross-org verification: ${role}`);
      return null;
    }

    // Don't verify if we're the home org for this role
    const currentOrg = this.configService.get<string>('ORG_NAME', '');
    if (this.isHomeOrg(role, currentOrg)) {
      this.logger.debug(`Skipping cross-org verification - ${role} is local to ${currentOrg}`);
      return null; // Return null to signal caller should use local DB
    }

    try {
      const data = await this.httpsGet(`${apiUrl}/auth/internal/verify-user/${userId}`, {
        'X-Internal-Key': this.internalApiKey,
      });

      if (!data) {
        this.logger.warn(`Cross-org verification failed for user ${userId}: no data`);
        return null;
      }

      this.logger.debug(`Cross-org verified user ${userId} from ${apiUrl}`);
      
      return {
        id: data.id,
        username: data.username,
        role: data.role,
        isActive: data.isActive,
      };
    } catch (error) {
      this.logger.error(`Cross-org verification error for user ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Make HTTPS GET request with self-signed cert support.
   */
  private httpsGet(url: string, headers: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname,
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        rejectUnauthorized: false, // Accept self-signed certs
        timeout: 5000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
  }

  /**
   * Check if the current org is the home org for a given role.
   */
  private isHomeOrg(role: UserRole, currentOrg: string): boolean {
    const roleToOrg: Record<UserRole, string> = {
      [UserRole.CUSTOMER]: 'platform',
      [UserRole.SELLER]: 'sellers',
      [UserRole.DELIVERY_PERSON]: 'logistics',
      [UserRole.ADMIN]: 'platform',
    };
    return roleToOrg[role] === currentOrg;
  }

  /**
   * Fetch delivery persons from the Logistics API.
   * Used when sellers need to list available drivers for handoff.
   */
  async fetchDeliveryPersons(): Promise<Array<{ id: string; username: string; fullName: string; vehicleInfo?: any }>> {
    const apiUrl = RoleToApiUrl[UserRole.DELIVERY_PERSON];
    
    try {
      const data = await this.httpsGet(`${apiUrl}/users/internal/delivery-persons`, {
        'X-Internal-Key': this.internalApiKey,
      });

      if (!data || !data.data) {
        this.logger.warn('Failed to fetch delivery persons from Logistics API');
        return [];
      }

      this.logger.debug(`Fetched ${data.data.length} delivery persons from Logistics API`);
      return data.data;
    } catch (error) {
      this.logger.error(`Error fetching delivery persons: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch customer delivery address from the Platform API.
   * Used when delivery persons need to see delivery destination.
   */
  async fetchCustomerAddress(customerId: string): Promise<{ fullName: string; address: any } | null> {
    const apiUrl = RoleToApiUrl[UserRole.CUSTOMER];
    
    try {
      const data = await this.httpsGet(`${apiUrl}/users/internal/customer-address/${customerId}`, {
        'X-Internal-Key': this.internalApiKey,
      });

      if (!data || !data.success || !data.data) {
        this.logger.warn(`Failed to fetch customer address for ${customerId}`);
        return null;
      }

      this.logger.debug(`Fetched customer address for ${customerId} from Platform API`);
      return data.data;
    } catch (error) {
      this.logger.error(`Error fetching customer address: ${error.message}`);
      return null;
    }
  }
}
