import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { Roller } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';
import { verifyAuditChain } from '@belediyesinden/audit';

/**
 * Denetim (audit) endpoint — `/api/audit`.
 * Hash-chain bütünlük doğrulaması (Superadmin/TenantAdmin).
 */
@Roller(KullaniciRolu.Superadmin, KullaniciRolu.TenantAdmin, KullaniciRolu.Encumen)
@Controller('audit')
export class AuditController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Audit hash-chain bütünlüğünü doğrula → { ok, brokenAt }. */
  @Get('verify')
  async verify() {
    return verifyAuditChain(this.ds);
  }
}
