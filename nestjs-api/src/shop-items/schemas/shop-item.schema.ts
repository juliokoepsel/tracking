import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ShopItemDocument = ShopItem & Document;

@Schema({ collection: 'shop_items', timestamps: true })
export class ShopItem {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  sellerId: string;

  @Prop({ required: true, minlength: 1, maxlength: 200 })
  name: string;

  @Prop({ required: true, minlength: 1, maxlength: 2000 })
  description: string;

  @Prop({ required: true, min: 1 })
  priceInCents: number; // Store price in cents to avoid floating point issues

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ShopItemSchema = SchemaFactory.createForClass(ShopItem);

// Compound index for seller queries
ShopItemSchema.index({ sellerId: 1, isActive: 1 });
