import { Module } from '@nestjs/common';
import { EvrakModule } from '../evrak/evrak.module';
import { TeminatModule } from '../teminat/teminat.module';
import { VarlikModule } from '../varlik/varlik.module';
import { IlanController } from './ilan.controller';
import { IlanService } from './ilan.service';
import { IlanKalemiService } from './ilan-kalemi.service';
import { GorselService } from './gorsel.service';

@Module({
  imports: [TeminatModule, EvrakModule, VarlikModule],
  controllers: [IlanController],
  providers: [IlanService, IlanKalemiService, GorselService],
})
export class IlanModule {}
