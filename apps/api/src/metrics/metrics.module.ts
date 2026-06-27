import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';

/** Prometheus metrics modülü. */
@Module({
  controllers: [MetricsController],
})
export class MetricsModule {}
