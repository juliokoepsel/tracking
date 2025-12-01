import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WalletIdentityDocument = WalletIdentity & Document;

@Schema({ collection: 'wallet_identities', timestamps: true })
export class WalletIdentity {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ required: true })
  mspId: string;

  @Prop({ required: true })
  certificate: string;

  @Prop({ required: true })
  privateKey: string;

  @Prop({ required: true })
  organization: string;

  @Prop({ default: false })
  isRevoked: boolean;

  @Prop()
  enrollmentId: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const WalletIdentitySchema = SchemaFactory.createForClass(WalletIdentity);
