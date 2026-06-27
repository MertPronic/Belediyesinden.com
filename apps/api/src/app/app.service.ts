import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

interface HealthCheck {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: 'ok' | 'down';
  service: string;
  timestamp: string;
  uptime: number;
  checks: Record<string, HealthCheck>;
}

/** Sağlık kontrolü — DB ping + süre/metaveri. */
@Injectable()
export class AppService {
  private readonly logger = new Logger('Health');

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async getHealth(): Promise<HealthResponse> {
    const checks: Record<string, HealthCheck> = {};

    // DB ping.
    const start = Date.now();
    try {
      await this.ds.query('SELECT 1');
      checks.db = { status: 'up', latencyMs: Date.now() - start };
    } catch (e) {
      checks.db = { status: 'down', error: (e as Error).message };
      this.logger.error('DB sağlık kontrolü başarısız: ' + (e as Error).message);
    }

    const allUp = Object.values(checks).every((c) => c.status === 'up');
    return {
      status: allUp ? 'ok' : 'down',
      service: 'belediyesinden-api',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      checks,
    };
  }
}
