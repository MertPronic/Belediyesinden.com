import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { AllExceptionsFilter } from './app/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // HTTP güvenliği (#63).
  app.use(helmet({ contentSecurityPolicy: false })); // CSP nginx katmanında; burada diğer korumalar
  app.enableCors({
    origin: process.env['CORS_ORIGINS']?.split(',') ?? true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Input doğrulama (#62) — tüm DTO'lara class-validator, whitelist ile fazlayı düşür.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Tutarlı hata yanıtı (#62).
  app.useGlobalFilters(new AllExceptionsFilter());

  // pino structured logger (LoggerModule ile).
  const logger = app.get(Logger);
  app.useLogger(logger);

  // WebSocket (ws) adapter — gerçek zamanlı teklif yayını (JWT doğrulamalı).
  app.useWebSocketAdapter(new WsAdapter(app));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
  logger.log(`🔌 WebSocket: ws://localhost:${port}/ws`);
}

bootstrap();
