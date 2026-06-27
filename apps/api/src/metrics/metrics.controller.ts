import { Controller, Get, Header } from '@nestjs/common';
import { Unprotected } from '@belediyesinden/auth';
import { metricsRegistry } from './registry';

/**
 * Prometheus metrics endpoint — `/api/metrics` (public, scrape için).
 * Node + process default metrics + uygulama metrikleri (http istek sayısı/süresi).
 */
@Unprotected()
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    return metricsRegistry.metrics();
  }
}
