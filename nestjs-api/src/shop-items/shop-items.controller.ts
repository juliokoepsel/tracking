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

import { ShopItemsService } from './shop-items.service';
import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { UpdateShopItemDto } from './dto/update-shop-item.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';

@Controller('shop-items')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ShopItemsController {
  constructor(private readonly shopItemsService: ShopItemsService) {}

  @Post()
  @Roles(UserRole.SELLER)
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() createDto: CreateShopItemDto,
  ) {
    const item = await this.shopItemsService.create(user.id, createDto);
    return {
      success: true,
      message: 'Shop item created successfully',
      data: {
        id: item._id,
        name: item.name,
        description: item.description,
        priceInCents: item.priceInCents,
        isActive: item.isActive,
      },
    };
  }

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN)
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('sellerId') sellerId?: string,
  ) {
    const items = await this.shopItemsService.findAll(
      user.id,
      user.role as UserRole,
      sellerId,
    );

    return {
      success: true,
      count: items.length,
      data: items.map((item) => ({
        id: item._id,
        sellerId: item.sellerId,
        name: item.name,
        description: item.description,
        priceInCents: item.priceInCents,
        isActive: item.isActive,
      })),
    };
  }

  @Get('my-items')
  @Roles(UserRole.SELLER)
  async findMyItems(@CurrentUser() user: CurrentUserData) {
    const items = await this.shopItemsService.findBySeller(user.id);

    return {
      success: true,
      count: items.length,
      data: items.map((item) => ({
        id: item._id,
        name: item.name,
        description: item.description,
        priceInCents: item.priceInCents,
        isActive: item.isActive,
        createdAt: item.createdAt,
      })),
    };
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN)
  async findOne(@Param('id') id: string) {
    const item = await this.shopItemsService.findById(id);

    if (!item) {
      return { success: false, message: 'Shop item not found' };
    }

    return {
      success: true,
      data: {
        id: item._id,
        sellerId: item.sellerId,
        name: item.name,
        description: item.description,
        priceInCents: item.priceInCents,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    };
  }

  @Put(':id')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() updateDto: UpdateShopItemDto,
  ) {
    const item = await this.shopItemsService.update(
      id,
      user.id,
      user.role as UserRole,
      updateDto,
    );

    return {
      success: true,
      message: 'Shop item updated successfully',
      data: {
        id: item._id,
        name: item.name,
        description: item.description,
        priceInCents: item.priceInCents,
        isActive: item.isActive,
      },
    };
  }

  @Delete(':id')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.shopItemsService.delete(id, user.id, user.role as UserRole);

    return {
      success: true,
      message: 'Shop item deleted successfully',
    };
  }
}
