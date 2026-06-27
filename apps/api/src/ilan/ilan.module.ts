import { Module } from '@nestjs/common';
import { EvrakModule } from '../evrak/evrak.module';
import { TeminatModule } from '../teminat/teminat.module';
import { IlanController } from './ilan.controller';
import { IlanService } from './ilan.service';
import { GorselService } from './gorsel.service';

@Module({
  imports: [TeminatModule, EvrakModule],
  controllers: [IlanController],
  providers: [IlanService, GorselService],
})
export class IlanModule {}
