import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WalletIdentityDocument = WalletIdentity & Document;

/**
 * Encrypted private key storage structure
 * Uses AES-256-GCM for authenticated encryption
 */
@Schema({ _id: false })
export class EncryptedKey {
  @Prop({ required: true })
  ciphertext: string; // Base64 encoded encrypted data

  @Prop({ required: true })
  iv: string; // Base64 encoded initialization vector (12 bytes for GCM)

  @Prop({ required: true })
  authTag: string; // Base64 encoded authentication tag (16 bytes)

  @Prop({ required: true })
  algorithm: string; // Always 'aes-256-gcm'
}

export const EncryptedKeySchema = SchemaFactory.createForClass(EncryptedKey);

@Schema({ collection: 'wallet_identities', timestamps: true })
export class WalletIdentity {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ required: true })
  mspId: string;

  @Prop({ required: true })
  certificate: string;

  @Prop({ type: EncryptedKeySchema, required: true })
  encryptedPrivateKey: EncryptedKey; // Encrypted with AES-256-GCM

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
