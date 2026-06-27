import { Module } from '@nestjs/common';
import { EvrakModule } from '../evrak/evrak.module';
import { TeminatController } from './teminat.controller';
import { TeminatService } from './teminat.service';

/** Tenant-scoped teminat modülü (MinioService için EvrakModule'ü importer). */
@Module({
  imports: [EvrakModule],
  controllers: [TeminatController],
  providers: [TeminatService],
})
export class TeminatModule {}
