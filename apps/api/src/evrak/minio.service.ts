import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client as MinioClient } from 'minio';

/**
 * MinIO (S3-uyumlu) nesne depolama servisi. Bucket'ı startup'ta oluşturur.
 * İmza (e-imza) entegrasyon noktası: dosyalar buradan geçer (Faz 3 spike).
 */
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly bucket = process.env['MINIO_BUCKET'] ?? 'belediyesinden';
  private client!: MinioClient;

  async onModuleInit(): Promise<void> {
    this.client = new MinioClient({
      endPoint: process.env['MINIO_ENDPOINT'] ?? 'localhost',
      port: Number(process.env['MINIO_PORT'] ?? 9000),
      useSSL: false,
      accessKey: process.env['MINIO_ROOT_USER'] ?? 'minioadmin',
      secretKey: process.env['MINIO_ROOT_PASSWORD'] ?? 'minioadmin',
    });
    const exists = await this.client.bucketExists(this.bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  putObject(key: string, buffer: Buffer, contentType?: string): Promise<unknown> {
    return this.client.putObject(this.bucket, key, buffer, buffer.length, {
      ...(contentType ? { 'Content-Type': contentType } : {}),
    });
  }

  getObject(key: string): Promise<unknown> {
    return this.client.getObject(this.bucket, key);
  }
}
