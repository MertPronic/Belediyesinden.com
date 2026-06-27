import { Module } from '@nestjs/common';
import { EvrakModule } from '../evrak/evrak.module';
import { TeminatController } from './teminat.controller';
import { TeminatService } from './teminat.service';
import { TeminatIadeService } from './teminat-iade.service';

@Module({
  imports: [EvrakModule],
  controllers: [TeminatController],
  providers: [TeminatService, TeminatIadeService],
  exports: [TeminatIadeService],
})
export class TeminatModule {}
