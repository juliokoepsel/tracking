import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard for internal API calls between organization services.
 * Validates the X-Internal-Key header against the shared INTERNAL_API_KEY.
 * 
 * Use this guard on endpoints that should only be accessible by other
 * org APIs for cross-org verification (e.g., verifying a customer exists
 * when they create an order on the Sellers API).
 */
@Injectable()
export class InternalApiGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const internalKey = request.headers['x-internal-key'];
    const expectedKey = this.configService.get<string>('INTERNAL_API_KEY');

    if (!expectedKey) {
      throw new UnauthorizedException('Internal API key not configured');
    }

    if (!internalKey || internalKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing internal API key');
    }

    return true;
  }
}
