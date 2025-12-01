import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

import { FabricGatewayService } from './fabric-gateway.service';
import { FabricCAService } from './fabric-ca.service';
import { WalletService } from './wallet.service';
import { WalletIdentity, WalletIdentitySchema } from './schemas/wallet-identity.schema';

@Global()
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: WalletIdentity.name, schema: WalletIdentitySchema },
    ]),
  ],
  providers: [FabricGatewayService, FabricCAService, WalletService],
  exports: [FabricGatewayService, FabricCAService, WalletService],
})
export class FabricModule {}
