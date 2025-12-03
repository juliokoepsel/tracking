import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'your-super-secret-key-change-in-production'),
    });
  }

  /**
   * Validate JWT token and return user data.
   * 
   * In multi-org architecture:
   * - First tries to find user in local database
   * - If not found locally, trusts the JWT payload (user from another org)
   * 
   * This is secure because:
   * 1. JWT signature is verified (token wasn't tampered with)
   * 2. Token expiration is checked
   * 3. For sensitive write operations (orders, deliveries), the service layer
   *    performs additional cross-org verification via CrossOrgVerificationService
   */
  async validate(payload: JwtPayload) {
    // First, try to find user in local database
    const user = await this.usersService.findById(payload.sub);

    if (user) {
      // User exists locally - verify they're active
      if (!user.isActive) {
        throw new UnauthorizedException('User deactivated');
      }
      return {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        isLocalUser: true, // Flag to indicate user is in local DB
      };
    }

    // User not in local DB - trust JWT payload for cross-org requests
    // The JWT was signed with our shared secret, so the signature is valid
    // For sensitive operations, services will call CrossOrgVerificationService
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      id: payload.sub,
      username: payload.username || 'cross-org-user',
      email: payload.email || '',
      role: payload.role,
      fullName: payload.fullName || '',
      isLocalUser: false, // Flag to indicate user is from another org
    };
  }
}
