import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ShopItemsService } from './shop-items.service';
import { ShopItemsController } from './shop-items.controller';
import { ShopItem, ShopItemSchema } from './schemas/shop-item.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ShopItem.name, schema: ShopItemSchema }]),
  ],
  controllers: [ShopItemsController],
  providers: [ShopItemsService],
  exports: [ShopItemsService],
})
export class ShopItemsModule {}
