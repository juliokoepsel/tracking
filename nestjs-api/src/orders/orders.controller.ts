import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { OrderStatus, UserRole } from '../common/enums';

@Controller('orders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() createDto: CreateOrderDto,
  ) {
    const order = await this.ordersService.create(user.id, createDto);
    return {
      success: true,
      message: 'Order created successfully',
      data: {
        id: order._id,
        sellerId: order.sellerId,
        customerId: order.customerId,
        items: order.items,
        totalInCents: order.totalInCents,
        status: order.status,
        createdAt: order.createdAt,
      },
    };
  }

  @Post(':id/confirm')
  @Roles(UserRole.SELLER)
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() confirmDto: ConfirmOrderDto,
  ) {
    const { order, deliveryId } = await this.ordersService.confirm(
      id,
      user.id,
      confirmDto,
    );

    return {
      success: true,
      message: 'Order confirmed and delivery created',
      data: {
        id: order._id,
        status: order.status,
        deliveryId,
      },
    };
  }

  @Put(':id/cancel')
  @Roles(UserRole.CUSTOMER)
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    const order = await this.ordersService.cancel(id, user.id);

    return {
      success: true,
      message: 'Order cancelled successfully',
      data: {
        id: order._id,
        status: order.status,
      },
    };
  }

  @Get('my')
  @Roles(UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN)
  async findMyOrders(
    @CurrentUser() user: CurrentUserData,
    @Query('status') status?: OrderStatus,
  ) {
    const orders = await this.ordersService.findAll(
      user.id,
      user.role as UserRole,
      status,
    );

    return {
      success: true,
      count: orders.length,
      data: orders.map((order) => ({
        id: order._id,
        sellerId: order.sellerId,
        customerId: order.customerId,
        items: order.items,
        totalInCents: order.totalInCents,
        deliveryId: order.deliveryId,
        status: order.status,
        createdAt: order.createdAt,
      })),
    };
  }

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN)
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('status') status?: OrderStatus,
  ) {
    const orders = await this.ordersService.findAll(
      user.id,
      user.role as UserRole,
      status,
    );

    return {
      success: true,
      count: orders.length,
      data: orders.map((order) => ({
        id: order._id,
        sellerId: order.sellerId,
        customerId: order.customerId,
        items: order.items,
        totalInCents: order.totalInCents,
        deliveryId: order.deliveryId,
        status: order.status,
        createdAt: order.createdAt,
      })),
    };
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    const order = await this.ordersService.findById(
      id,
      user.id,
      user.role as UserRole,
    );

    if (!order) {
      return { success: false, message: 'Order not found' };
    }

    return {
      success: true,
      data: {
        id: order._id,
        sellerId: order.sellerId,
        customerId: order.customerId,
        items: order.items,
        totalInCents: order.totalInCents,
        deliveryId: order.deliveryId,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    };
  }
}
