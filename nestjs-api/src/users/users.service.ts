import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FabricCAService } from '../fabric/fabric-ca.service';
import { WalletService } from '../fabric/wallet.service';
import { UserRole, RoleToMSPMap, RoleToOrgMap } from '../common/enums';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private fabricCAService: FabricCAService,
    private walletService: WalletService,
  ) {}

  /**
   * Create a new user with Fabric CA enrollment
   */
  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    // Validate that the role is allowed for this API instance's organization
    if (!this.fabricCAService.isRoleAllowedForOrg(createUserDto.role as UserRole)) {
      const currentOrg = this.fabricCAService.getCurrentOrg();
      throw new BadRequestException(
        `Role ${createUserDto.role} cannot be registered through this API (${currentOrg}). ` +
        `Use the appropriate organization's API endpoint.`
      );
    }

    // Check for existing user
    const existingUser = await this.userModel.findOne({
      $or: [
        { username: createUserDto.username },
        { email: createUserDto.email },
      ],
    });

    if (existingUser) {
      throw new ConflictException('Username or email already exists');
    }

    // Validate role-specific requirements
    if (createUserDto.role === UserRole.DELIVERY_PERSON && !createUserDto.vehicleInfo) {
      throw new BadRequestException('Delivery persons must provide vehicle information');
    }

    if (createUserDto.role === UserRole.CUSTOMER && !createUserDto.address) {
      throw new BadRequestException('Customers must provide a delivery address');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Determine affiliation string based on organization
    const org = RoleToOrgMap[createUserDto.role];
    const affiliation = org || 'independent';

    // Create user in MongoDB
    const user = new this.userModel({
      ...createUserDto,
      hashedPassword,
      isActive: true,
      hasBlockchainIdentity: false,
      affiliation,
    });

    await user.save();

    this.logger.log(`Created user: ${user.username} (${user.role})`);

    // Enroll with Fabric CA (async - don't block user creation)
    this.enrollUserWithFabricCA(user).catch((error) => {
      this.logger.error(`Failed to enroll user ${user.username} with Fabric CA: ${error.message}`);
    });

    return user;
  }

  /**
   * Enroll user with Fabric CA and store identity in wallet
   */
  private async enrollUserWithFabricCA(user: UserDocument): Promise<void> {
    if (!this.fabricCAService.isReady()) {
      this.logger.warn('Fabric CA not ready, skipping enrollment');
      return;
    }

    try {
      const userId = user._id.toString();
      const role = user.role as UserRole;

      // Enroll with Fabric CA
      const enrollment = await this.fabricCAService.enrollUser(userId, role);

      // Store in wallet
      const mspId = RoleToMSPMap[role];
      const org = RoleToOrgMap[role];

      await this.walletService.put(
        userId,
        mspId,
        enrollment.certificate,
        enrollment.privateKey,
        org,
        userId,
      );

      // Update user to indicate they have blockchain identity
      await this.userModel.updateOne(
        { _id: user._id },
        { hasBlockchainIdentity: true },
      );

      this.logger.log(`Enrolled user ${user.username} with Fabric CA (${org})`);
    } catch (error: any) {
      this.logger.error(`Fabric CA enrollment failed for ${user.username}: ${error.message}`);
      // Don't throw - user is still created in MongoDB
    }
  }

  /**
   * Find all users with optional filters
   */
  async findAll(filters?: {
    role?: UserRole;
    isActive?: boolean;
  }): Promise<UserDocument[]> {
    const query: any = {};

    if (filters?.role) {
      query.role = filters.role;
    }

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    return this.userModel.find(query).select('-hashedPassword').exec();
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  /**
   * Find active delivery persons
   */
  async findActiveDeliveryPersons(): Promise<UserDocument[]> {
    return this.userModel
      .find({
        role: UserRole.DELIVERY_PERSON,
        isActive: true,
      })
      .select('-hashedPassword')
      .exec();
  }

  /**
   * Update a user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If password is being updated, hash it
    if (updateUserDto.password) {
      (updateUserDto as any).hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
      delete updateUserDto.password;
    }

    Object.assign(user, updateUserDto);
    await user.save();

    this.logger.log(`Updated user: ${user.username}`);

    return user;
  }

  /**
   * Deactivate a user (soft delete)
   */
  async deactivate(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isActive = false;
    await user.save();

    // Revoke Fabric identity
    if (user.hasBlockchainIdentity) {
      try {
        await this.fabricCAService.revokeUser(id, user.role as UserRole);
        await this.walletService.revoke(id);
      } catch (error) {
        this.logger.error(`Failed to revoke Fabric identity for user ${id}: ${error}`);
      }
    }

    this.logger.log(`Deactivated user: ${user.username}`);

    return user;
  }

  /**
   * Get user's delivery address (for delivery persons)
   */
  async getDeliveryAddress(
    customerId: string,
  ): Promise<{ fullName: string; address: any } | null> {
    const customer = await this.userModel.findById(customerId);

    if (!customer || customer.role !== UserRole.CUSTOMER || !customer.address) {
      return null;
    }

    return {
      fullName: customer.fullName,
      address: customer.address,
    };
  }
}
