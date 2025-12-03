import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  // HTTPS configuration
  const httpsOptions = {
    key: fs.readFileSync(
      process.env.SSL_KEY_PATH || path.join('/app/certs', 'nestjs-key.pem'),
    ),
    cert: fs.readFileSync(
      process.env.SSL_CERT_PATH || path.join('/app/certs', 'nestjs.pem'),
    ),
  };

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS - restrict in production
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Application running on: https://localhost:${port}/api/v1`);
}

bootstrap();
