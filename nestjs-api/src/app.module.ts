import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ShopItemsModule } from './shop-items/shop-items.module';
import { OrdersModule } from './orders/orders.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { FabricModule } from './fabric/fabric.module';
import { EventsModule } from './events/events.module';
import { HealthController } from './health.controller';
import { databaseConfig } from './config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      load: [databaseConfig],
    }),

    // MongoDB
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
      }),
      inject: [ConfigService],
    }),

    // Feature modules
    FabricModule,
    AuthModule,
    UsersModule,
    ShopItemsModule,
    OrdersModule,
    DeliveriesModule,
    EventsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
