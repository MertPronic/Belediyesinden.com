import { Module } from '@nestjs/common';
import { IlanKurallariController } from './ilan-kurallari.controller';
import { IlanKurallariService } from './ilan-kurallari.service';

/** İlan kuralları modülü (tenant bazlı parametrik kural yönetimi). */
@Module({
  controllers: [IlanKurallariController],
  providers: [IlanKurallariService],
})
export class IlanKurallariModule {}
