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

import { DeliveriesService } from './deliveries.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { InitiateHandoffDto } from './dto/initiate-handoff.dto';
import { ConfirmHandoffDto } from './dto/confirm-handoff.dto';
import { DisputeHandoffDto } from './dto/dispute-handoff.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { DeliveryStatus, UserRole } from '../common/enums';

@Controller('deliveries')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Get()
  @Roles(UserRole.SELLER, UserRole.CUSTOMER, UserRole.DELIVERY_PERSON, UserRole.ADMIN)
  async getAll(@CurrentUser() user: CurrentUserData) {
    const deliveries = await this.deliveriesService.getMyDeliveries(user.id);

    return {
      success: true,
      count: deliveries.length,
      data: deliveries.map((d) => ({
        deliveryId: d.deliveryId,
        orderId: d.orderId,
        deliveryStatus: d.deliveryStatus,
        lastLocation: d.lastLocation,
        currentCustodianId: d.currentCustodianId,
        currentCustodianRole: d.currentCustodianRole,
        updatedAt: d.updatedAt,
        hasPendingHandoff: !!d.pendingHandoff,
      })),
    };
  }

  @Get('my')
  @Roles(UserRole.SELLER, UserRole.CUSTOMER, UserRole.DELIVERY_PERSON, UserRole.ADMIN)
  async getMyDeliveries(@CurrentUser() user: CurrentUserData) {
    const deliveries = await this.deliveriesService.getMyDeliveries(user.id);

    return {
      success: true,
      count: deliveries.length,
      data: deliveries.map((d) => ({
        deliveryId: d.deliveryId,
        orderId: d.orderId,
        deliveryStatus: d.deliveryStatus,
        lastLocation: d.lastLocation,
        currentCustodianId: d.currentCustodianId,
        currentCustodianRole: d.currentCustodianRole,
        customerId: d.customerId,
        pendingHandoff: d.pendingHandoff,
        updatedAt: d.updatedAt,
        hasPendingHandoff: !!d.pendingHandoff,
      })),
    };
  }

  @Get('status/:status')
  @Roles(UserRole.SELLER, UserRole.CUSTOMER, UserRole.DELIVERY_PERSON, UserRole.ADMIN)
  async getByStatus(
    @CurrentUser() user: CurrentUserData,
    @Param('status') status: DeliveryStatus,
  ) {
    const deliveries = await this.deliveriesService.getDeliveriesByStatus(user.id, status);

    return {
      success: true,
      count: deliveries.length,
      data: deliveries,
    };
  }

  @Get('company/:companyId')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  async getByCompany(
    @CurrentUser() user: CurrentUserData,
    @Param('companyId') companyId: string,
  ) {
    const deliveries = await this.deliveriesService.getDeliveriesByCompany(user.id, companyId);

    return {
      success: true,
      count: deliveries.length,
      data: deliveries,
    };
  }

  @Get(':id')
  @Roles(UserRole.SELLER, UserRole.CUSTOMER, UserRole.DELIVERY_PERSON, UserRole.ADMIN)
  async getDelivery(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const delivery = await this.deliveriesService.getDelivery(user.id, id);

    return {
      success: true,
      data: delivery,
    };
  }

  @Get(':id/address')
  @Roles(UserRole.DELIVERY_PERSON, UserRole.ADMIN)
  async getDeliveryAddress(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const addressInfo = await this.deliveriesService.getDeliveryAddress(
      user.id,
      user.role as UserRole,
      id,
    );

    if (!addressInfo) {
      return { success: false, message: 'Customer address not available' };
    }

    return {
      success: true,
      data: addressInfo,
    };
  }

  @Get(':id/history')
  @Roles(UserRole.SELLER, UserRole.CUSTOMER, UserRole.ADMIN)
  async getDeliveryHistory(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const history = await this.deliveriesService.getDeliveryHistory(user.id, id);

    return {
      success: true,
      count: history.length,
      data: history,
    };
  }

  @Put(':id/location')
  @Roles(UserRole.DELIVERY_PERSON)
  async updateLocation(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    await this.deliveriesService.updateLocation(user.id, id, dto);

    return {
      success: true,
      message: 'Location updated successfully',
    };
  }

  @Put(':id/cancel')
  @Roles(UserRole.CUSTOMER)
  async cancelDelivery(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    await this.deliveriesService.cancelDelivery(user.id, id);

    return {
      success: true,
      message: 'Delivery cancelled successfully',
    };
  }

  @Post(':id/handoff/initiate')
  @Roles(UserRole.SELLER, UserRole.DELIVERY_PERSON)
  @HttpCode(HttpStatus.OK)
  async initiateHandoff(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: InitiateHandoffDto,
  ) {
    await this.deliveriesService.initiateHandoff(user.id, id, dto);

    return {
      success: true,
      message: 'Handoff initiated successfully',
    };
  }

  @Post(':id/handoff/confirm')
  @Roles(UserRole.DELIVERY_PERSON, UserRole.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async confirmHandoff(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: ConfirmHandoffDto,
  ) {
    await this.deliveriesService.confirmHandoff(user.id, id, dto);

    return {
      success: true,
      message: 'Handoff confirmed successfully',
    };
  }

  @Post(':id/handoff/dispute')
  @Roles(UserRole.DELIVERY_PERSON, UserRole.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async disputeHandoff(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: DisputeHandoffDto,
  ) {
    await this.deliveriesService.disputeHandoff(user.id, id, dto);

    return {
      success: true,
      message: 'Handoff disputed successfully',
    };
  }

  @Post(':id/handoff/cancel')
  @Roles(UserRole.SELLER, UserRole.DELIVERY_PERSON)
  @HttpCode(HttpStatus.OK)
  async cancelHandoff(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    await this.deliveriesService.cancelHandoff(user.id, id);

    return {
      success: true,
      message: 'Handoff cancelled successfully',
    };
  }
}
