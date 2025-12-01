import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserRole } from '../../common/enums';

export type UserDocument = User & Document;

@Schema({ _id: false })
export class AddressInfo {
  @Prop({ required: true })
  street: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true })
  country: string;

  @Prop({ required: true })
  postalCode: string;
}

export const AddressInfoSchema = SchemaFactory.createForClass(AddressInfo);

@Schema({ _id: false })
export class VehicleInfo {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  licensePlate: string;
}

export const VehicleInfoSchema = SchemaFactory.createForClass(VehicleInfo);

@Schema({ collection: 'users', timestamps: true })
export class User {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, minlength: 3, maxlength: 50, index: true })
  username: string;

  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true })
  hashedPassword: string;

  @Prop({ required: true, enum: UserRole, index: true })
  role: UserRole;

  @Prop({ required: true, minlength: 1, maxlength: 100 })
  fullName: string;

  @Prop({ type: VehicleInfoSchema })
  vehicleInfo?: VehicleInfo; // For delivery personnel

  @Prop({ type: AddressInfoSchema })
  address?: AddressInfo; // For customers and sellers

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  hasBlockchainIdentity: boolean; // Whether user is enrolled with Fabric CA

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
