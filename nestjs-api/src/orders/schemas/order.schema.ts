import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderStatus } from '../../common/enums';

export type OrderDocument = Order & Document;

@Schema({ _id: false })
export class OrderItem {
  @Prop({ required: true })
  itemId: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 1 })
  priceAtPurchase: number; // Price in cents at time of order
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ collection: 'orders', timestamps: true })
export class Order {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  sellerId: string;

  @Prop({ required: true, index: true })
  customerId: string;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ required: true, min: 1 })
  totalInCents: number;

  @Prop({ index: true, sparse: true })
  deliveryId?: string; // Set when order is confirmed and delivery created

  @Prop({ required: true, enum: OrderStatus, default: OrderStatus.PENDING, index: true })
  status: OrderStatus;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Compound indexes
OrderSchema.index({ sellerId: 1, status: 1 });
OrderSchema.index({ customerId: 1, status: 1 });
