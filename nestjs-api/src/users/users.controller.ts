import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return {
      success: true,
      message: 'User created successfully',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
    };
  }

  @Get()
  @Roles(UserRole.ADMIN)
  async findAll(
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: string,
  ) {
    const users = await this.usersService.findAll({
      role,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });

    return {
      success: true,
      message: 'Users retrieved successfully',
      count: users.length,
      data: users.map((user) => ({
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        isActive: user.isActive,
        hasBlockchainIdentity: user.hasBlockchainIdentity,
        createdAt: user.createdAt,
      })),
    };
  }

  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserData) {
    const fullUser = await this.usersService.findById(user.id);
    return {
      success: true,
      data: {
        id: fullUser?._id,
        username: fullUser?.username,
        email: fullUser?.email,
        role: fullUser?.role,
        fullName: fullUser?.fullName,
        address: fullUser?.address,
        vehicleInfo: fullUser?.vehicleInfo,
        isActive: fullUser?.isActive,
        hasBlockchainIdentity: fullUser?.hasBlockchainIdentity,
      },
    };
  }

  @Get('delivery-persons')
  @Roles(UserRole.SELLER, UserRole.DELIVERY_PERSON, UserRole.ADMIN)
  async findDeliveryPersons() {
    const users = await this.usersService.findActiveDeliveryPersons();
    return {
      success: true,
      count: users.length,
      data: users.map((user) => ({
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        vehicleInfo: user.vehicleInfo,
      })),
    };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return {
      success: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        address: user.address,
        vehicleInfo: user.vehicleInfo,
        isActive: user.isActive,
        hasBlockchainIdentity: user.hasBlockchainIdentity,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.usersService.update(id, updateUserDto);
    return {
      success: true,
      message: 'User updated successfully',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        isActive: user.isActive,
      },
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string) {
    const user = await this.usersService.deactivate(id);
    return {
      success: true,
      message: 'User deactivated successfully',
      data: {
        id: user._id,
        username: user.username,
        isActive: user.isActive,
      },
    };
  }
}
