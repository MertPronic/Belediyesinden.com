import { Module } from '@nestjs/common';
import { TeminatModule } from '../teminat/teminat.module';
import { IlanController } from './ilan.controller';
import { IlanService } from './ilan.service';

@Module({
  imports: [TeminatModule],
  controllers: [IlanController],
  providers: [IlanService],
})
export class IlanModule {}
