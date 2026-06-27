import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';

/** Denetim (audit) modülü — bütünlük doğrulama endpoint'i. */
@Module({
  controllers: [AuditController],
})
export class AuditModule {}
