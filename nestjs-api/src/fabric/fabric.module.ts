import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { FabricGatewayService } from './fabric-gateway.service';
import { FabricCAService } from './fabric-ca.service';
import { WalletService } from './wallet.service';
import { ChaincodeEventsService } from './chaincode-events.service';
import { WalletIdentity, WalletIdentitySchema } from './schemas/wallet-identity.schema';

@Global()
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    MongooseModule.forFeature([
      { name: WalletIdentity.name, schema: WalletIdentitySchema },
    ]),
  ],
  providers: [FabricGatewayService, FabricCAService, WalletService, ChaincodeEventsService],
  exports: [FabricGatewayService, FabricCAService, WalletService, ChaincodeEventsService],
})
export class FabricModule {}
