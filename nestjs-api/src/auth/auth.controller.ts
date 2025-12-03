import { Controller, Post, Body, Get, Param, HttpCode, HttpStatus, UseGuards, NotFoundException } from '@nestjs/common';
import { AuthService, AuthResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { InternalApiGuard } from './guards/internal-api.guard';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto.username, loginDto.password);
  }

  /**
   * Internal endpoint for cross-org user verification.
   * Protected by InternalApiGuard - only accessible with X-Internal-Key header.
   * 
   * Used when one org's API needs to verify a user exists in another org's database.
   * Example: Sellers API verifying a customer exists before creating an order.
   */
  @Get('internal/verify-user/:userId')
  @UseGuards(InternalApiGuard)
  async verifyUser(@Param('userId') userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      isActive: user.isActive,
    };
  }
}
