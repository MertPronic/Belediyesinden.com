/**
 * Belediyesinden Worker — bağımsız BullMQ işçi (teminat iade).
 * createApplicationContext ile çalışır (HTTP listener yok).
 * TeminatIadeService constructor'da BullMQ queue+worker başlatır.
 *
 * Deploy: docker build -f apps/worker/Dockerfile . (API Dockerfile'ı gibi, pre-build dist)
 * Çalışma: REDIS_HOST, POSTGRES_* env gereklidir.
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './app/worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const logger = new Logger('Worker');
  logger.log('🔧 Worker başladı — teminat iade BullMQ işçisi aktif (Redis).');
  logger.log('   Bekleyen iade job\'ları otomatik işlenecek.');

  // Graceful shutdown.
  app.enableShutdownHooks();
}

bootstrap();
