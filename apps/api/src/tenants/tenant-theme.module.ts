import { Module } from '@nestjs/common';
import { TenantThemeController } from './tenant-theme.controller';

/** Tenant tema (herkese açık) modülü. */
@Module({
  controllers: [TenantThemeController],
})
export class TenantThemeModule {}
