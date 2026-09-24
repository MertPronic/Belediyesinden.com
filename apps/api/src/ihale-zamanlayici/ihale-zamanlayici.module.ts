import { Module } from '@nestjs/common';
import { IlanModule } from '../ilan/ilan.module';
import { BildirimModule } from '../bildirim/bildirim.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { IhaleZamanlayiciService } from './ihale-zamanlayici.service';

/** İhale otomatik başlatma + 4 saat öncesi hatırlatma (bkz. IhaleZamanlayiciService). */
@Module({
  imports: [IlanModule, BildirimModule, IntegrationsModule],
  providers: [IhaleZamanlayiciService],
})
export class IhaleZamanlayiciModule {}
