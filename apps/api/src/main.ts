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

  // HTTP güvenliği (#63). CSP nginx katmanında; crossOriginResourcePolicy gevşetiliyor —
  // API tenant-web/portal gibi farklı origin'lerden <img>/<a> ile doğrudan tüketiliyor
  // (ilan görselleri, evrak indirme); Helmet'in varsayılanı (same-origin) CORS'tan
  // bağımsız bir katman olarak bu "no-cors" yüklemeleri tamamen engelliyordu.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Private Network Access (Chrome): tenant-web/portal (localhost:4200/4201) API'ye
  // (localhost:3000) <img>/<a> gibi header taşıyamayan isteklerle erişirken tarayıcı
  // bir PNA preflight'ı gönderir; `cors` paketi bu header'ı desteklemediği için
  // elle ekleniyor — yoksa asıl istek tarayıcı tarafından sunucuya hiç ulaşmadan
  // engellenir (ilan görselleri/evrak indirme linkleri bu yüzden kırık görünüyordu).
  app.use((req: import('express').Request, res: import('express').Response, next: () => void) => {
    if (req.headers['access-control-request-private-network']) {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    next();
  });

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
