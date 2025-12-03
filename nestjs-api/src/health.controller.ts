import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  async check() {
    const dbState = this.connection.readyState;
    const dbConnected = dbState === 1;

    return {
      status: dbConnected ? 'healthy' : 'unhealthy',
      service: 'nestjs-api',
      database_connected: dbConnected,
      timestamp: new Date().toISOString(),
    };
  }
}
