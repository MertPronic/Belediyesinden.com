import { Module } from '@nestjs/common';
import { TenantThemeController } from './tenant-theme.controller';
import { TenantProvisioningController } from './tenant-provisioning.controller';

/** Tenant modülü — tema (public) + provisioning (Superadmin). */
@Module({
  controllers: [TenantThemeController, TenantProvisioningController],
})
export class TenantThemeModule {}
