import { Module, forwardRef } from '@nestjs/common';

import { DeliveriesService } from './deliveries.service';
import { DeliveriesController } from './deliveries.controller';
import { FabricModule } from '../fabric/fabric.module';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    FabricModule,
    UsersModule,
    forwardRef(() => OrdersModule),
  ],
  controllers: [DeliveriesController],
  providers: [DeliveriesService],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
