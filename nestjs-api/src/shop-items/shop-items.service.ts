import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ShopItem, ShopItemDocument } from './schemas/shop-item.schema';
import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { UpdateShopItemDto } from './dto/update-shop-item.dto';
import { UserRole } from '../common/enums';

@Injectable()
export class ShopItemsService {
  private readonly logger = new Logger(ShopItemsService.name);

  constructor(
    @InjectModel(ShopItem.name) private shopItemModel: Model<ShopItemDocument>,
  ) {}

  async create(sellerId: string, createDto: CreateShopItemDto): Promise<ShopItemDocument> {
    const item = new this.shopItemModel({
      ...createDto,
      sellerId,
      isActive: true,
    });

    await item.save();
    this.logger.log(`Created shop item: ${item.name} by seller ${sellerId}`);

    return item;
  }

  /**
   * Public endpoint - returns all active shop items
   */
  async findAllPublic(sellerId?: string): Promise<ShopItemDocument[]> {
    const query: any = { isActive: true };
    
    if (sellerId) {
      query.sellerId = sellerId;
    }

    return this.shopItemModel.find(query).exec();
  }

  async findAll(
    userId: string,
    userRole: UserRole,
    sellerId?: string,
  ): Promise<ShopItemDocument[]> {
    const query: any = {};

    // Admin sees all items
    // Customers see only active items
    // Sellers can filter by their own items
    if (userRole === UserRole.CUSTOMER) {
      query.isActive = true;
    } else if (userRole === UserRole.SELLER) {
      // If sellerId provided and matches the user, show all their items
      // Otherwise show only active items
      if (sellerId === userId) {
        query.sellerId = userId;
      } else if (sellerId) {
        query.sellerId = sellerId;
        query.isActive = true;
      } else {
        query.isActive = true;
      }
    }
    // Admin sees everything

    return this.shopItemModel.find(query).exec();
  }

  async findBySeller(sellerId: string): Promise<ShopItemDocument[]> {
    return this.shopItemModel.find({ sellerId }).exec();
  }

  async findById(id: string): Promise<ShopItemDocument | null> {
    return this.shopItemModel.findById(id).exec();
  }

  async update(
    id: string,
    userId: string,
    userRole: UserRole,
    updateDto: UpdateShopItemDto,
  ): Promise<ShopItemDocument> {
    const item = await this.shopItemModel.findById(id);

    if (!item) {
      throw new NotFoundException('Shop item not found');
    }

    // Only the owner seller or admin can update
    if (userRole !== UserRole.ADMIN && item.sellerId !== userId) {
      throw new ForbiddenException('You can only update your own items');
    }

    Object.assign(item, updateDto);
    await item.save();

    this.logger.log(`Updated shop item: ${item.name}`);

    return item;
  }

  async delete(id: string, userId: string, userRole: UserRole): Promise<void> {
    const item = await this.shopItemModel.findById(id);

    if (!item) {
      throw new NotFoundException('Shop item not found');
    }

    // Only the owner seller or admin can delete
    if (userRole !== UserRole.ADMIN && item.sellerId !== userId) {
      throw new ForbiddenException('You can only delete your own items');
    }

    await this.shopItemModel.deleteOne({ _id: id });

    this.logger.log(`Deleted shop item: ${item.name}`);
  }
}
