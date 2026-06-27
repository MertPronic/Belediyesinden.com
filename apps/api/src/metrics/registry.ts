import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

/** Prometheus metrik registry'si (tek instance). */
export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

/** HTTP istek sayısı (method + route + status etiketli). */
export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Toplam HTTP istek sayısı',
  labelNames: ['method', 'route', 'status'],
  registers: [metricsRegistry],
});

/** HTTP istek süresi (saniye, histogram). */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP istek süresi',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});
