import { Injectable, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from '../common/enums';

export interface JwtPayload {
  sub: string; // userId
  username: string;
  role: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    full_name: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    vehicleInfo?: {
      type?: string;
      licensePlate?: string;
    };
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<UserDocument | null> {
    const user = await this.usersService.findByUsername(username);

    if (!user) {
      this.logger.warn(`Login failed: user '${username}' not found`);
      return null;
    }

    if (!user.isActive) {
      this.logger.warn(`Login failed: user '${username}' is deactivated`);
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);

    if (!isPasswordValid) {
      this.logger.warn(`Login failed: invalid password for user '${username}'`);
      return null;
    }

    return user;
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    const user = await this.validateUser(username, password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user._id.toString(),
      username: user.username,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`User '${username}' logged in successfully`);

    return {
      access_token: accessToken,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.fullName,
        address: user.address,
        vehicleInfo: user.vehicleInfo,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    // Validate that only certain roles can self-register (not ADMIN)
    if (registerDto.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot self-register as admin');
    }

    // Role-specific validation
    if (registerDto.role === UserRole.CUSTOMER && !registerDto.address) {
      throw new BadRequestException('Customers must provide a delivery address');
    }

    if (registerDto.role === UserRole.DELIVERY_PERSON && !registerDto.vehicleInfo) {
      throw new BadRequestException('Delivery persons must provide vehicle information');
    }

    // Create the user (the UsersService will also enroll them with Fabric CA)
    const user = await this.usersService.create({
      username: registerDto.username,
      email: registerDto.email,
      password: registerDto.password,
      role: registerDto.role,
      fullName: registerDto.fullName || registerDto.username, // Default to username if not provided
      address: registerDto.address,
      vehicleInfo: registerDto.vehicleInfo,
      companyId: registerDto.companyId,
      companyName: registerDto.companyName,
    });

    // Generate JWT
    const payload: JwtPayload = {
      sub: user._id.toString(),
      username: user.username,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`User '${registerDto.username}' registered successfully as ${registerDto.role}`);

    return {
      access_token: accessToken,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.fullName,
        address: user.address,
        vehicleInfo: user.vehicleInfo,
      },
    };
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
